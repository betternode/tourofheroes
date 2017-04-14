import { Injectable } from '@angular/core';

import { Observable } from 'rxjs/Observable';
import { Observer } from 'rxjs/Observer';
import { Subject } from 'rxjs/Subject';
import { ReplaySubject } from 'rxjs/ReplaySubject';

import { IActionService } from './action.service.interface';
import { GLOBALS } from '../globals';
import { PlayerService } from '../player/player.service';
import { StatsService } from '../stats/stats.service';
import { Zone,
    ActionOutcome,
    ProtoActionOutcome,
    SecondaryAction,
    LiveZoneAction,
    ZoneAction,
    ZoneActionDescription,
    ActionEvent,
    SkillMap, getTruthySkills, SkillType,
    NamedUnlock
 } from '../core/index';
import { RealLiveZoneAction } from './reallivezoneaction';

export interface PostActionInfo {
    outcome: ActionOutcome;
    nextAction: LiveZoneAction;
}

interface DelayCalc {
    delay: number;
    slowdown: number;
}

@Injectable()
export class ActionService implements IActionService {

    public currentAction: RealLiveZoneAction;
    public activeZone: Zone;
    // Replays the one last action
    public postActionSubject: Subject<PostActionInfo> =
        new ReplaySubject<PostActionInfo>(1);

    private _actionSpeedMultiplier = 1.0;
    // Inexperience penalty multiplied by this amount
    public inexpMultiplier = 1.0;
    private eggs = 0;

    // Experimental
    protoActionOutcomeSubject: Subject<ProtoActionOutcome> =
        new Subject<ProtoActionOutcome>();

    constructor(
        private PS: PlayerService,
        private stats: StatsService
    ) { }

    get actionSpeedMultiplier(): number {
        return this._actionSpeedMultiplier;
    }
    set actionSpeedMultiplier(newValue: number) {
        console.assert(newValue > 0 && this._actionSpeedMultiplier > 0);
        let speedup = newValue / this._actionSpeedMultiplier;
        if (this.currentAction) {
            this.currentAction.adjustRemainingTime(speedup);
        }
        this._actionSpeedMultiplier = newValue;
    }

    // ------------------- ACTION BOOKKEEPING --------------------------

    /** Immediately terminate any action running in this zone, and stop
    looping actions for that zone. **/
    stopActionLoop(zone: Zone) {
        // TODO: would be cool to define a decorator that says "this is
        // a no-op if there's no actions going on right now"
        if (!this.activeZone || this.activeZone != zone) { return; }
        this.activeZone = undefined;
        this.currentAction.kill();
        this.currentAction = undefined;
    }
    stopAllActions() {
        if (this.activeZone) {
            this.stopActionLoop(this.activeZone);
        }
    }

    /** Return the currently running action in the given zone, if any **/
    ongoingActionForZone(zone: Zone) : LiveZoneAction {
        if (this.activeZone && zone.zid == this.activeZone.zid) {
            return this.currentAction;
        }
        return undefined;
    }

    startActionLoop(zone: Zone) : LiveZoneAction {
        this.stopAllActions();
        this.activeZone = zone;
        this.currentAction = this.runActionLoop();
        return this.currentAction;
    }

    private runActionLoop() : RealLiveZoneAction {
        let zoneaction: ZoneAction = this.chooseActionType(this.activeZone);
        let desc: ZoneActionDescription = zoneaction.chooseDescription();
        let delay = this.getDelay(zoneaction);
        let cb = () => {
            let outcome = this.getOutcome(zoneaction, desc.past); // bleh
            let nextAction = this.runActionLoop();
            let post = { outcome: outcome, nextAction: nextAction };
            this.postActionSubject.next(post);
            this.stats.actionTaken(this.activeZone.name);
        };
        let action: RealLiveZoneAction = new RealLiveZoneAction(
            desc.present, delay.delay, cb, this.activeZone.zid, delay.slowdown);
        this.currentAction = action;
        return action;
    }

    // ------------------- ACTION MECHANICS --------------------------
    private getDelay(action: ZoneAction): DelayCalc {
        let slowdown = action.slowdown(this.PS.player);
        slowdown *= this.inexpMultiplier;
        let skillAdjustedDelay = (slowdown+1) * GLOBALS.defaultBaseZoneDelay;
        let buffedDelay = skillAdjustedDelay / this.actionSpeedMultiplier;
        if (skillAdjustedDelay != buffedDelay) {
            console.log(`Delay buffed: ${buffedDelay}`);
        }
        return {delay: buffedDelay, slowdown: slowdown};
    }

    private getOutcome(action: ZoneAction, mainDesc: string): ActionOutcome {
        let proto:ProtoActionOutcome = {action: action,
            kickers: new Array<SecondaryAction>(),
            zone: this.activeZone,
            spMultiplier: 1
        };
        // By broadcasting this, we give observers the chance to mutate it
        // (by adding secondary effects), before we apply. Probably before.
        // Still not clear on the rxjs scheduler stuff.
        this.protoActionOutcomeSubject.next(proto);

        if (action.unlocks) {
            this.stats.unlock(action.unlocks);
        }
        if (action.oneshot) {
            this.stats.setOneShot(action.oneshot);
        }
        // I can already tell this is going to turn into a fucking monster
        // of a method
        // Was originally 100x, reducing since we increased default action duration
        if (this.currentAction.slowdown > 20.0) {
            this.stats.unlock(NamedUnlock.SuperSlowAction);
        }
        // Such a hack
        if (this.activeZone.name == "Gryphon Nest" &&
            action.skillDeltas[SkillType.Stealth] > 0) {
                this.eggs++;
                if (this.eggs == 3) {
                    this.stats.unlock(NamedUnlock.ThreeEggs);
                }
        } else {
            this.eggs = 0;
        }

        let crit = this.checkCrits(proto);
        // TODO: XXX: Probably want to pass this on in some more structured way
        // to the UI, and maybe some perk listeners or something. Being lazy for now.
        if (crit) {
            mainDesc += ' CRIT!';
        }
        let spBoost = (s: SkillMap, mlt: number) => s.map((sp) => sp*mlt);
        let mainEvent = {description: mainDesc,
            pointsGained: this.PS.trainSkills(
                spBoost(action.skillDeltas,
                    proto.spMultiplier * this.currentAction.spMultiplier)
            )};
        let kickerEvents:ActionEvent[] = new Array<ActionEvent>();
        for (let secondary of proto.kickers) {
            let kickerOutcome:ActionEvent = {description: secondary.description};
            if (secondary.skillPoints) {
                kickerOutcome.pointsGained = this.PS.trainSkills(
                    spBoost(secondary.skillPoints, proto.spMultiplier)
                );
            }
            kickerEvents.push(kickerOutcome);
        }
        let outcome:ActionOutcome = {main: mainEvent, secondary:kickerEvents};
        return outcome;
    }

    private checkCrits(proto: ProtoActionOutcome) : boolean {
        if (Math.random() < this.PS.player.meta.critChance) {
            /** TODO: seems like the crit multiplier should probably only
                apply to SP from the main outcome, and not from kickers. **/
            proto.spMultiplier *= this.PS.player.meta.critMultiplier;
            this.stats.crittedAction();
            return true;
        } else {
            return false;
        }
    }

    private chooseActionType(zone: Zone) : ZoneAction {
        let action: ZoneAction = zone.chooseAction();
        let tries = 1;
        let maxTries = 20;
        /** Note: This is a good reason to not use the oneshot property for
            high-probability actions. Could work around this cleanly, but it's
            a little tedious, so I'm just doing this the lazy way.
        **/
        while (
            (action.oneshot && this.stats.performedOneShot(action.oneshot))
            && tries++ < maxTries
        ) {
            action = zone.chooseAction();
        }
        if (tries == maxTries) {
            console.error(`Got a used oneshot action every time after
                ${maxTries} tries. Either this is a bug or we got spectacularly
                unlucky.`);
        }
        return action;
    }

}
