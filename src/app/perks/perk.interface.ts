import { Injector } from '@angular/core';
import { Observable } from 'rxjs/Observable';

/** Defines the interfaces exposed outside of the perk definition files and service
(i.e. to the view, and maybe some other services) **/

export interface Bonus {
    name: string;
    description: string;
}

export interface Spell extends Bonus {
    cooldown: number;
    remainingCooldown: number;
    /** Returns success/failure **/
    cast() : boolean;
}

/** Common parent of passives and (temporary) buffs **/
export interface BaseBuff extends Bonus {
    apply();
    /** Called when this buff should be removed. Could be called because this
    is a temporary buff and its timer ran out, or because of reincarnation.
    **/
    onDestroy();
}

export interface Buff extends BaseBuff {
    /** Returns a promise which resolves when this buff completes (e.g. because
    the timer ran out or some other condition was fulfilled). **/
    apply() : Promise<void>;
    /** Called when there's an attempt to add another instance of this buff
    when one is already running. May want to update the duration, or whatever.
    **/
    refresh(buff: Buff);
}

export interface Passive extends BaseBuff {
    apply();
}


export interface TimedBuff extends Buff {
    duration: number;
    remainingTime: number;
}

/** Let's come up with some clear nomenclature to start.

BONUS: something that modifies the game state (usually in a good way) according
    to some particular rules/conditions. Can modify player stats, action outcomes, etc.

BUFF: a temporary bonus (usually on a timer, but may have some other
    termination condition)

(maybe) ONESHOT: a degenerate buff having duration 0.

PASSIVE: a permanent bonus (at least, permanent wrt the lifetime of the character)
    (should basically be equivalent to a buff with infinite duration)

SPELL: something that can be activated by the player (on some cooldown), which may
    confer a bonus (usually a buff, rarely a perk), or have some other effect (?)

PERK: a passive or spell associated with a particular class

*/
