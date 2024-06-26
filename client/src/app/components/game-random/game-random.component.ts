import { Component } from '@angular/core';
import { PlayerService } from '@app/services/player.service';
import { QuestionsService } from '@app/services/questions.service';
import { SocketRoomService } from '@app/services/socket-room.service';
import { Game, Question } from '@common/game';
import { IconDefinition, faDice } from '@fortawesome/free-solid-svg-icons';
import { v4 } from 'uuid';

@Component({
    selector: 'app-game-random',
    templateUrl: './game-random.component.html',
    styleUrls: ['./game-random.component.scss'],
})
export class GameRandomComponent {
    faDice: IconDefinition = faDice;
    show: boolean = false;
    questions: Question[];
    game: Game;

    constructor(
        private questionService: QuestionsService,
        private socket: SocketRoomService,
        private playerService: PlayerService,
    ) {
        this.setQuestions();
    }

    launchGame(): void {
        this.socket.leaveRoom();
        this.playerService.player.isHost = true;
        this.playerService.player.name = 'Organisateur';
        this.socket.createRoom(this.game);
    }

    private async setQuestions(): Promise<void> {
        this.questionService.getRandomQuestions().then((questions) => {
            if (questions.length) {
                this.questions = questions;
                this.show = true;
                this.game = this.createGame();
            }
        });
    }

    private createGame(): Game {
        return {
            id: v4() + 'aleatoire',
            title: 'Mode Aléatoire',
            questions: this.questions,
            duration: 20,
        };
    }
}
