import { Component, Input } from '@angular/core';
import { SocketRoomService } from '@app/services/socket-room.service';
import { Game, Player } from '@common/game';

@Component({
    selector: 'app-player-and-admin-panel',
    templateUrl: './player-and-admin-panel.component.html',
    styleUrls: ['./player-and-admin-panel.component.scss'],
})
export class PlayerAndAdminPanelComponent {
    @Input() player: Player = {} as Player;
    @Input() game: Game = {} as Game;
    @Input() players: Player[] = [];

    constructor(private socket: SocketRoomService) {}

    lock() {
        this.socket.lockRoom();
    }

    unlock() {
        this.socket.unlockRoom();
    }

    startGame() {
        if (this.players.length > 0) {
            this.socket.startGame();
        } else {
            alert("Aucun joueur n'est présent dans la salle, le jeu ne peut pas commencer");
        }
    }

    kickPlayer(playerName: string) {
        this.socket.kickPlayer(playerName);
    }

    leaveRoom() {
        this.socket.leaveRoom();
    }
}