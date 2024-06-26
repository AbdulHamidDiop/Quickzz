import { Component, Input, OnDestroy } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { SocketRoomService } from '@app/services/socket-room.service';
import { RANDOM_INDICATOR, START_GAME_DELAY } from '@common/consts';
import { Game, Player } from '@common/game';
import { GAME_STARTED_MESSAGE, ROOM_LOCKED_MESSAGE, ROOM_UNLOCKED_MESSAGE } from '@common/message';
import { Events, Namespaces } from '@common/sockets';
import { IconDefinition, faDoorOpen, faLock, faLockOpen, faPlay, faRightFromBracket } from '@fortawesome/free-solid-svg-icons';
import { Subscription } from 'rxjs';

@Component({
    selector: 'app-player-and-admin-panel',
    templateUrl: './player-and-admin-panel.component.html',
    styleUrls: ['./player-and-admin-panel.component.scss'],
})
export class PlayerAndAdminPanelComponent implements OnDestroy {
    @Input() player: Player = {} as Player;
    @Input() game: Game = {} as Game;
    @Input() players: Player[] = [];
    room: string;
    roomLocked: boolean = false;
    inRandomMode: boolean = false;

    faLock: IconDefinition = faLock;
    faLockOpen: IconDefinition = faLockOpen;
    faDoorOpen: IconDefinition = faDoorOpen;
    faPlay: IconDefinition = faPlay;
    faRightFromBracket: IconDefinition = faRightFromBracket;

    private globalChatSubscription: Subscription;
    private playerLeftSubscription: Subscription;

    constructor(
        private socket: SocketRoomService,
        private snackBar: MatSnackBar,
    ) {
        this.socket.getChatMessages().subscribe((message) => {
            if (message.author === 'room') {
                this.room = message.message;
            }
        });

        this.globalChatSubscription = this.socket.getChatMessages().subscribe((message) => {
            if (message.author === 'room') {
                this.room = message.message;
            }
        });

        this.playerLeftSubscription = this.socket.listenForMessages(Namespaces.GAME, Events.PLAYER_LEFT).subscribe((data: unknown) => {
            const username = (data as { user: string }).user;
            this.players = this.players.filter((p) => p.name !== username);
        });
    }

    lock() {
        if (!this.roomLocked) {
            this.socket.lockRoom();
            ROOM_LOCKED_MESSAGE.timeStamp = new Date().toLocaleTimeString();
            this.socket.sendChatMessage(ROOM_LOCKED_MESSAGE);
            this.roomLocked = true;
        }
    }

    unlock() {
        if (this.roomLocked) {
            this.socket.unlockRoom();
            ROOM_UNLOCKED_MESSAGE.timeStamp = new Date().toLocaleTimeString();
            this.socket.sendChatMessage(ROOM_UNLOCKED_MESSAGE);
            this.roomLocked = false;
        }
    }

    startGame() {
        if (this.roomLocked) {
            if (this.inRandomMode) {
                this.startRandomGame();
            } else if (this.players.length > 0) {
                this.startNormalGame();
            } else {
                this.snackBar.open("Aucun joueur n'est présent dans la salle, le jeu ne peut pas commencer", 'Fermer', {
                    verticalPosition: 'top',
                    duration: START_GAME_DELAY,
                });
            }
        } else {
            this.snackBar.open('La partie doit être verrouillée avant de commencer', 'Fermer', {
                verticalPosition: 'top',
                duration: START_GAME_DELAY,
            });
        }
    }

    kickPlayer(playerName: string) {
        this.socket.kickPlayer(playerName);
        this.players = this.players.filter((p) => p.name !== playerName);
    }

    leaveRoom() {
        this.socket.leaveRoom();
        this.socket.endGame();
    }

    initializeGame(game: Game) {
        this.game = game;
        if (this.game.id.slice(RANDOM_INDICATOR) === 'aleatoire') {
            this.inRandomMode = true;
        }
    }

    ngOnDestroy() {
        this.globalChatSubscription.unsubscribe();
        this.playerLeftSubscription.unsubscribe();
    }

    private startNormalGame(): void {
        this.socket.startGame();
        GAME_STARTED_MESSAGE.timeStamp = new Date().toLocaleTimeString();
        this.socket.sendChatMessage(GAME_STARTED_MESSAGE);
    }

    private startRandomGame(): void {
        this.socket.startRandomGame();
        GAME_STARTED_MESSAGE.timeStamp = new Date().toLocaleTimeString();
        this.socket.sendChatMessage(GAME_STARTED_MESSAGE);
    }
}
