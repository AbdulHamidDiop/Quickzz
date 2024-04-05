import { Component, Input, OnInit } from '@angular/core';
import { Sort } from '@angular/material/sort';
import { SocketRoomService } from '@app/services/socket-room.service';
import { Player } from '@common/game';

@Component({
    selector: 'app-player-list',
    templateUrl: './player-list.component.html',
    styleUrls: ['./player-list.component.scss'],
})
export class PlayerListComponent implements OnInit {
    @Input() players: Player[] = [];

    protected sortedData: Player[];
    constructor(private socket: SocketRoomService) {
        this.sortedData = this.players.slice();
    }

    ngOnInit(): void {
        this.sortedData = this.players.slice();
    }

    excludeFromChat(player: Player) {
        this.socket.excludeFromChat(player);
    }

    includeInChat(player: Player) {
        this.socket.includeInChat(player);
    }

    colorToState(color: number | undefined) {
        // Devrait être des constantes globales.
        const RED = 0xff0000;
        const YELLOW = 0xffff00;
        const GREEN = 0x00ff00;
        const BLACK = 0x000000;
        switch (color) {
            case RED: {
                return 'Aucune réponse';
            }
            case YELLOW: {
                return 'Réponse en cours';
            }
            case GREEN: {
                return 'Réponse envoyée';
            }
            case BLACK: {
                return 'Abandon';
            }
            default: {
                return 'Erreur'; // Ne devrait jamais afficher ça, mais reste utile.
            }
        }
    }

    getStyle(player: Player) {
        const RED = 0xff0000;
        const YELLOW = 0xffff00;
        const GREEN = 0x00ff00;
        const BLACK = 0x000000;
        switch (player.color) {
            case RED: {
                return 'red-text';
            }
            case YELLOW: {
                return 'yellow-text';
            }
            case GREEN: {
                return 'green-text';
            }
            case BLACK: {
                return 'black-text';
            }
            default: {
                return 'blue-text'; // Ne devrait jamais afficher ça, mais reste utile.
            }
        }
    }

    sortData(sort: Sort) {
        const data = this.players.slice();
        if (!sort.active || sort.direction === '') {
            this.sortedData = data;
            return;
        }

        this.players = data.sort((a, b) => {
            const isAsc = sort.direction === 'asc';
            switch (sort.active) {
                case 'name':
                    return this.compare([a.name], [b.name], isAsc);
                case 'score':
                    // Trie par nom si les scores sont égaux
                    return this.compare([a.score, a.name], [b.score, b.name], isAsc);
                case 'state':
                    return this.compare([a.score, a.name], [b.score, b.score], isAsc);
                default:
                    return 0;
            }
        });
    }

    private compare(a: (number | string)[], b: (number | string)[], isAsc: boolean) {
        // Devrait être des constantes globales.
        const SORT_DECREASE = -1;
        const SORT_INCREASE = 1;
        if (a.length === 1 && b.length === 1) {
            // Code material, peut être amélioré plus tard
            return (a[0] < b[0] ? SORT_DECREASE : SORT_INCREASE) * (isAsc ? SORT_INCREASE : SORT_DECREASE);
        } else {
            // Deux paramètres, 0 = score ou etat, 1 = name
            if (a[0] !== b[0]) {
                return (a[0] < b[0] ? SORT_DECREASE : SORT_INCREASE) * (isAsc ? SORT_INCREASE : SORT_DECREASE);
            } else {
                return (a[1] < b[1] ? SORT_DECREASE : SORT_INCREASE) * SORT_INCREASE;
            }
        }
    }
}