import { Component, Input, OnInit, OnDestroy } from '@angular/core';

import { Zone } from '../core/index';
import { Zones } from './zones.service';
import { ZoneSummaryComponent } from './zone-summary.component';
import { PlayerService } from '../player/player.service';
import { GLOBALS } from '../globals';

interface SuperzonePane {
    name: string;
    unlocked: boolean;
    unlockDescription: string;
    zones: Zone[];
}

@Component({
    selector: 'zones',
    directives: [ ZoneSummaryComponent ],
    styles: [
        `
        .zone-header {
            font-weight: bold;
        }
        .locked {
            opacity: .5; /* placeholder */
        }
        `,],
    template: `
    <div>

    <ul class="nav nav-tabs">
        <li *ngFor="let pane of visiblePanes()"
        [class.active]="activePane==pane"
        [class.locked]="!pane.unlocked"
         >
            <a (click)="activePane=pane"
            [title]="pane.unlockDescription"
            >{{pane.name}}</a>
        </li>
    </ul>

    <div class="tab-content">
        <div *ngFor="let pane of panes"
         class="tab-pane"
         [class.active]="activePane==pane"
         >
            <ul *ngIf="activePane==pane" class="list-group">
                <li class="list-group-item zone-header">
                <div class="row">
                    <div class="col-xs-2">Zone</div>
                    <div class="col-xs-1">Level</div>
                    <div class="col-xs-4">Skills</div>
                    <div class="col-xs-2"
                    title="If your skill levels are too low, actions will take longer"
                    >Slowdown</div>
                    <div class="col-xs-3"></div>
                </div>
                </li>

                <li *ngFor="let zone of pane.zones" class="list-group-item">
                    <zone-summary [zone]="zone" [youAreHere]="zones.focalZone==zone"
                    [locked]="!pane.unlocked">
                    </zone-summary>
                </li>
            </ul>
        </div>
    </div>

    </div>
    `
})
export class ZonesComponent implements OnInit {
    activePane: SuperzonePane;
    panes: SuperzonePane[] = new Array<SuperzonePane>();

    constructor(
        private zones: Zones,
        private PS: PlayerService
    ) {
        /** I keep trying to push logic into ngOnInit, because some part of
        the tutorial told me to do that, but it always seems to lead to weird,
        hard-to-understand fuckups, so here we are.
        **/
        console.assert(this.panes.length == 0);
        for (let superz of this.zones.superzones) {
            this.panes.push({
                name: superz.name, unlocked: superz.unlockCondition(this.PS.player.level),
                zones: superz.zones, unlockDescription: superz.unlockDescription
            });
        }
        this.activePane = this.panes[0];
        console.assert(this.activePane.unlocked);

        // On level up, check whether any new superzones have been unlocked.
        this.PS.playerLevel$.subscribe( (lvl:number) => {
            for (let i=0; i < this.panes.length; i++) {
                this.panes[i].unlocked = this.zones.superzones[i].
                    unlockCondition(this.PS.player.level)
            }
        });
    }

    /** Only show unlocked panes plus the *first* locked pane (i.e. the one
    that will be unlocked next). **/
    visiblePanes() {
        let vis = [];
        for (let pane of this.panes) {
            if (pane.unlocked || GLOBALS.cheatMode) {
                vis.push(pane);
            } else {
                vis.push(pane);
                break;
            }
        }
        return vis;
    }

    ngOnInit() {

    }

}
