import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { GameManagerService } from '@app/services/game-manager.service';
import { SocketRoomService } from '@app/services/socket-room.service';
import { TimeService } from '@app/services/time.service';
import { Game, Player, Question } from '@common/game';
import { QCMStats } from '@common/game-stats';
// import { PlayAreaComponent } from '../play-area/play-area.component';

@Component({
    selector: 'app-host-game-view',
    templateUrl: './host-game-view.component.html',
    styleUrls: ['./host-game-view.component.scss'],
})
export class HostGameViewComponent implements OnInit {
    game: Game;
    currentQuestion: Question;
    countdown: number;
    players: Player[];
    stats: QCMStats[];

    constructor(
        public gameManagerService: GameManagerService,
        // public playArea: PlayAreaComponent,
        readonly timeService: TimeService,
        private route: ActivatedRoute,
        private socketService: SocketRoomService,
    ) {
        this.socketService.getPlayers().subscribe((players: Player[]) => {
            this.players = players;
            console.log('John');
        });
        this.socketService.getStats().subscribe((stat: QCMStats) => {
            this.stats.push(stat);
            console.log(stat);
        });
    }

    async ngOnInit(): Promise<void> {
        const gameID = this.route.snapshot.paramMap.get('id');
        if (gameID) {
            await this.gameManagerService.initialize(gameID);
        }
        this.currentQuestion = this.gameManagerService.nextQuestion();
        this.countdown = this.timeService.time;
        console.log(this.currentQuestion);
    }
}
