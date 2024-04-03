/* eslint-disable max-lines */
import { ChangeDetectorRef, Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, Router } from '@angular/router';
import { ConfirmDialogModel } from '@app/classes/confirm-dialog-model';
import { ConfirmDialogComponent } from '@app/components/confirm-dialog/confirm-dialog.component';
import { MouseButton } from '@app/interfaces/game-elements';
import { GameManagerService } from '@app/services/game-manager.service';
import { PlayerService } from '@app/services/player.service';
import { QRLStatService } from '@app/services/qrl-stats.service';
import { SocketRoomService } from '@app/services/socket-room.service';
import { TimeService } from '@app/services/time.service';
import { Feedback } from '@common/feedback';
import { Player, Question, Type } from '@common/game';
import { QCMStats, QRLAnswer, QRLGrade } from '@common/game-stats';
import { ChatMessage, SystemMessages as sysmsg } from '@common/message';
import { Events, Namespaces as nsp } from '@common/sockets';
import { Subscription } from 'rxjs';
import { BONUS_MULTIPLIER, ERROR_INDEX, MAX_QRL_LENGTH, QRL_TIMER, SHOW_FEEDBACK_DELAY } from './const';

@Component({
    selector: 'app-play-area',
    templateUrl: './play-area.component.html',
    styleUrls: ['./play-area.component.scss'],
})
export class PlayAreaComponent implements OnInit, OnDestroy {
    player: Player;
    inTestMode: boolean = false;
    buttonPressed = '';
    question: Question = {} as Question;

    answer: string[] = [];
    qrlAnswer: string = '';
    nbChoices: number;
    score = 0;

    showPoints: boolean = false;
    showCountDown: boolean = false;
    countDownKey: number = Date.now(); // to force change dete/ctiosn
    choiceDisabled = false;
    feedback: Feedback[];
    qcmStat: QCMStats;
    bonusGiven = false;
    gotBonus = false;

    private timer: number;
    private points = 0;

    private nextQuestionSubscription: Subscription;
    private endGameSubscription: Subscription;
    private abortGameSubscription: Subscription;
    private bonusSubscription: Subscription;
    private bonusGivenSubscription: Subscription;
    private sendQRLAnswerSubscription: Subscription;
    private qrlGradeSubscription: Subscription;
    private startTimerSubscription: Subscription;
    private stopTimerSubscription: Subscription;
    private pauseTimerSubscription: Subscription;

    // eslint-disable-next-line max-params
    // On a besoin de tout ces injections pour l'instant. Nous n'avons pas encore trouvé de moyen pour découpler ce component.
    constructor(
        readonly timeService: TimeService,
        readonly gameManager: GameManagerService,
        readonly socketService: SocketRoomService,
        readonly playerService: PlayerService,
        private qrlStatsService: QRLStatService,
        private changeDetector: ChangeDetectorRef,
        public abortDialog: MatDialog,
        public router: Router,
        private route: ActivatedRoute,
        private snackBar: MatSnackBar,
    ) {
        this.player = this.playerService.player;
        this.answer = [];
        if (this.route.snapshot.queryParams.testMode === 'true') {
            this.inTestMode = true;
        }
    }

    get time(): number {
        return this.timeService.time;
    }

    get point(): number {
        return this.points;
    }

    get playerScore(): number {
        return this.score;
    }

    get charsLeft(): number {
        return MAX_QRL_LENGTH - this.qrlAnswer.length;
    }

    @HostListener('keydown', ['$event'])
    detectButton(event: KeyboardEvent) {
        this.buttonPressed = event.key;
        if (this.buttonPressed === 'Enter' && this.question.type === Type.QCM && !this.choiceDisabled) {
            this.confirmAnswers();
        } else if (
            this.buttonPressed >= '1' &&
            this.buttonPressed <= '4' &&
            this.question.type === Type.QCM &&
            this.buttonPressed <= this.nbChoices.toString()
        ) {
            const index = parseInt(this.buttonPressed, 10);
            this.handleQCMChoice(this.question.choices[index - 1].text);
        }
    }

    async ngOnInit() {
        this.startTimerSubscription = this.socketService.listenForMessages(nsp.GAME, Events.START_TIMER).subscribe(() => {
            this.timer = this.question.type === Type.QCM ? (this.gameManager.game.duration as number) : QRL_TIMER;
            this.timeService.startTimer(this.timer);
        });

        this.timeService.timerEnded.subscribe(async () => {
            await this.confirmAnswers();
        });
        const gameID = this.route.snapshot.paramMap.get('id');
        if (this.inTestMode && gameID) {
            await this.gameManager.initialize(gameID);
        } else {
            await this.gameManager.initialize(this.socketService.room);
        }
        this.question = this.gameManager.firstQuestion();
        if (this.question.type === Type.QRL) {
            this.qrlStatsService.startTimer(this.question.id);
        }
        this.nbChoices = this.question.choices?.length ?? 0;
        if (this.inTestMode) {
            this.timer = this.question.type === Type.QCM ? (this.gameManager.game.duration as number) : QRL_TIMER;
            this.timeService.startTimer(this.timer);
        }

        this.nextQuestionSubscription = this.socketService.listenForMessages(nsp.GAME, Events.NEXT_QUESTION).subscribe(async () => {
            await this.confirmAnswers();
            if (this.question.type === Type.QCM) {
                this.feedback = await this.gameManager.getFeedBack(this.question.id, this.answer);
            }
            await this.countPointsAndNextQuestion();
        });

        this.endGameSubscription = this.socketService.listenForMessages(nsp.GAME, Events.END_GAME).subscribe(async () => {
            await this.confirmAnswers();
            if (this.question.type === Type.QCM) {
                this.feedback = await this.gameManager.getFeedBack(this.question.id, this.answer);
            }
            await this.countPointsAndNextQuestion();
            setTimeout(() => {
                this.endGame();
            }, SHOW_FEEDBACK_DELAY);
        });

        this.stopTimerSubscription = this.socketService.listenForMessages(nsp.GAME, Events.STOP_TIMER).subscribe(() => {
            this.timeService.stopTimer();
        });

        this.pauseTimerSubscription = this.socketService.listenForMessages(nsp.GAME, Events.PAUSE_TIMER).subscribe(() => {
            this.timeService.pauseTimer();
        });

        this.sendQRLAnswerSubscription = this.socketService.listenForMessages(nsp.GAME, Events.SEND_QRL_ANSWER).subscribe(() => {
            this.sendQRLAnswer();
        });

        this.qrlGradeSubscription = this.socketService.listenForMessages(nsp.GAME, Events.QRL_GRADE).subscribe((grade: unknown) => {
            const qrlGrade = grade as QRLGrade;
            if (qrlGrade.author === this.player.name) {
                this.score += qrlGrade.grade;
                this.player.score = this.score;
                this.bonusGiven = false;
                this.gotBonus = false;
            }
            this.socketService.sendMessage(Events.UPDATE_PLAYER, nsp.GAME_STATS, this.player);
        });

        this.bonusSubscription = this.socketService.listenForMessages(nsp.GAME, Events.BONUS).subscribe(() => {
            this.gotBonus = true;
        });

        this.bonusGivenSubscription = this.socketService.listenForMessages(nsp.GAME, Events.BONUS_GIVEN).subscribe(() => {
            this.bonusGiven = true;
        });

        this.abortGameSubscription = this.socketService.listenForMessages(nsp.GAME, Events.ABORT_GAME).subscribe(() => {
            this.snackBar.open("L'organisateur a mis fin à la partie", 'Fermer', {
                duration: 5000,
                verticalPosition: 'top',
            });
            this.router.navigate(['/']);
            this.socketService.endGame();
        });

        window.addEventListener('hashchange', this.onLocationChange);
        window.addEventListener('popstate', this.onLocationChange);
    }
    ngOnDestroy() {
        this.timeService.stopTimer();
        this.qrlStatsService.stopTimer();
        this.gameManager.reset();

        this.nextQuestionSubscription?.unsubscribe();
        this.endGameSubscription?.unsubscribe();
        this.bonusSubscription?.unsubscribe();
        this.bonusGivenSubscription?.unsubscribe();
        this.abortGameSubscription?.unsubscribe();
        this.startTimerSubscription?.unsubscribe();
        this.stopTimerSubscription?.unsubscribe();
        this.qrlGradeSubscription?.unsubscribe();
        this.sendQRLAnswerSubscription?.unsubscribe();
        this.pauseTimerSubscription?.unsubscribe();

        window.removeEventListener('popstate', this.onLocationChange);
        window.removeEventListener('hashchange', this.onLocationChange);
    }

    shouldRender(text: string) {
        return text !== '';
    }

    goNextQuestion() {
        this.answer = [];
        this.qrlAnswer = '';
        this.endGameTest();
        const newQuestion = this.gameManager.goNextQuestion();
        this.question = newQuestion;
        if (newQuestion && newQuestion.type === 'QCM') {
            this.nbChoices = this.question.choices.length;
        }
        if (newQuestion && newQuestion.type === 'QRL') {
            this.qrlStatsService.startTimer(newQuestion.id);
        }
        this.changeDetector.detectChanges();
        if (this.inTestMode) {
            this.timeService.stopTimer();
            this.timer = this.question.type === Type.QCM ? (this.gameManager.game.duration as number) : QRL_TIMER;
            this.timeService.startTimer(this.timer);
        }
    }

    handleQCMChoice(answer: string) {
        let choiceInList = false;
        for (let i = 0; i < this.answer.length; i++) {
            if (answer === this.answer[i]) {
                this.answer.splice(i, 1);
                choiceInList = true;
                i--;
                break;
            }
        }
        if (!choiceInList) {
            this.answer.push(answer);
        }

        this.qcmStat = {
            questionId: this.question.id,
            choiceIndex: this.question.choices.findIndex((c) => c.text === answer),
            correctIndex: this.question.choices.find((choice) => choice.isCorrect)?.index ?? ERROR_INDEX,
            choiceAmount: this.nbChoices,
            selected: !choiceInList,
        };
        this.socketService.sendMessage(Events.QCM_STATS, nsp.GAME_STATS, this.qcmStat);
    }

    isChoice(choice: string): boolean {
        return this.answer.includes(choice);
    }

    async confirmAnswers() {
        this.timeService.stopTimer();
        this.choiceDisabled = true;

        if (this.inTestMode) {
            if (this.question.type === Type.QCM) {
                this.feedback = await this.gameManager.getFeedBack(this.question.id, this.answer);
            }
            this.countPointsAndNextQuestion();
            return;
        }
    }

    sendQRLAnswer() {
        this.timeService.stopTimer();
        this.qrlStatsService.stopTimer();
        this.choiceDisabled = true;

        const qrlAnswer: QRLAnswer = {
            questionId: this.question.id,
            author: this.player.name,
            answer: this.qrlAnswer,
        };
        this.socketService.sendMessage(Events.QRL_ANSWER, nsp.GAME, qrlAnswer);
        this.snackBar.open('Votre réponse a été envoyée pour correction, veuillez patienter', 'Fermer', {
            duration: 5000,
            verticalPosition: 'top',
        });
    }

    async countPointsAndNextQuestion() {
        if (this.question.type === Type.QCM || this.inTestMode) {
            await this.updateScore();
        }
        setTimeout(
            () => {
                this.choiceDisabled = false;
                this.goNextQuestion();
            },
            this.inTestMode ? SHOW_FEEDBACK_DELAY : SHOW_FEEDBACK_DELAY * 2,
        );
        if (!this.inTestMode) {
            setTimeout(() => {
                this.openCountDownModal();
            }, SHOW_FEEDBACK_DELAY);
        }
    }

    onQRLAnswerChange() {
        this.qrlStatsService.notifyEdit();
    }

    onFinalAnswer() {
        if (!this.bonusGiven) {
            this.socketService.sendMessage(Events.FINAL_ANSWER, nsp.GAME);
        }
    }
    async updateScore() {
        if (this.question.type === Type.QRL && this.inTestMode) {
            this.score += this.question.points;
            return;
        }
        const isCorrectAnswer = await this.gameManager.isCorrectAnswer(this.answer, this.question.id);
        if (isCorrectAnswer && this.question.points) {
            this.showPoints = true;
            setTimeout(() => {
                this.showPoints = false;
            }, SHOW_FEEDBACK_DELAY);

            this.score += this.question.points;
            if (this.inTestMode || this.gotBonus) {
                this.score += this.question.points * BONUS_MULTIPLIER;
                this.player.bonusCount++;
            }

            this.player.score = this.score;
            this.bonusGiven = false;
            this.gotBonus = false;
        }
        this.socketService.sendMessage(Events.UPDATE_PLAYER, nsp.GAME_STATS, this.player);
    }

    handleAbort(): void {
        const message = 'Êtes-vous sûr de vouloir abandonner la partie?';

        const dialogData = new ConfirmDialogModel('Abandon', message);

        const dialogRef = this.abortDialog.open(ConfirmDialogComponent, {
            maxWidth: '400px',
            data: dialogData,
        });

        dialogRef.afterClosed().subscribe((dialogResult) => {
            if (dialogResult) {
                this.timeService.stopTimer();
                this.score = 0;
                this.answer = [];
                const chatMessage: ChatMessage = {
                    author: sysmsg.AUTHOR,
                    message: this.player.name + ' ' + sysmsg.PLAYER_LEFT,
                    timeStamp: new Date().toLocaleTimeString(),
                };
                this.socketService.sendChatMessage(chatMessage);
                this.router.navigate(['/']);
                this.onLocationChange();
            }
        });
    }

    endGame() {
        window.removeEventListener('popstate', this.onLocationChange);
        window.removeEventListener('hashchange', this.onLocationChange);
        this.router.navigate(['results'], { relativeTo: this.route });
    }

    onLocationChange = () => {
        this.socketService.endGame();
    };

    endGameTest() {
        if (this.gameManager.endGame && this.inTestMode) {
            this.router.navigate(['/createGame']);
        }
    }

    mouseHitDetect(event: MouseEvent) {
        if (event.button === MouseButton.Left) {
            this.timeService.stopTimer();
            this.timeService.startTimer(this.timer);
        }
    }

    getStyle(choiceText: string): string {
        if (!this.feedback) return '';
        const feedbackItem = this.feedback?.find((f) => f.choice === choiceText);
        if (!feedbackItem) return '';

        return feedbackItem.status;
    }

    openCountDownModal(): void {
        this.showCountDown = true;
        this.countDownKey = Date.now();
    }

    onCountDownModalClosed(): void {
        this.showCountDown = false;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    trackByFunction(item: any) {
        return item.id;
    }
}
