import { Component, OnInit } from '@angular/core';

import { PerkService } from './perk.service';
import { Spell, Buff, Passive } from './perk.interface';

@Component({
    selector: 'perks',
    template: `
    <div class="perks">
        <h3>Perks</h3>

        <div class="buffs">
            <div *ngFor="let buff of buffs">
                <a title="{{buff.description}}">
                    {{buff.name}}
                    <span *ngIf="buff.remainingTime">(
                        {{buff.remainingTime/1000 | number:'1.0-0'}}
                    )
                    </span>
                </a>
            </div>
        </div>

        <div class="perks">
            <div *ngFor="let passive of passives">
                <a title="{{passive.description}}">
                    {{passive.name}}
                </a>
            </div>
        </div>

    </div>
    `
})
export class PerksComponent implements OnInit {
    constructor(
        private PRKS: PerkService
    ) {

    }

    ngOnInit () {
    }

    get spells(): Spell[] {
        return this.PRKS.getSpells();
    }
    get buffs(): Buff[] {
        return this.PRKS.getBuffs();
    }
    get passives(): Passive[] {
        return this.PRKS.getPassives();
    }

}
