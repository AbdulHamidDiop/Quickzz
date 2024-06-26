import * as dragDrop from '@angular/cdk/drag-drop';
import { CdkDragDrop, CdkDropList } from '@angular/cdk/drag-drop';
import { AfterViewInit, ChangeDetectorRef, Component, OnInit, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, Router } from '@angular/router';
import { AdminQuestionsBankComponent } from '@app/components/admin-questions-bank/admin-questions-bank.component';
import { CreateQuestionDialogComponent } from '@app/components/create-question-dialog/create-question-dialog.component';
import { CommunicationService } from '@app/services/communication.service';
import { GameService } from '@app/services/game.service';
import { Game, Question } from '@common/game';
import { v4 } from 'uuid';
import { MAX_DURATION, MIN_DURATION } from './const';

@Component({
    selector: 'app-admin-create-game-page',
    templateUrl: './admin-create-game-page.component.html',
    styleUrls: ['./admin-create-game-page.component.scss'],
})
export class AdminCreateGamePageComponent implements OnInit, AfterViewInit {
    @ViewChild(AdminQuestionsBankComponent) questionsBankComponent!: AdminQuestionsBankComponent;
    questionsBankList!: CdkDropList;

    gameForm: FormGroup;
    game: Game;
    id: string;
    questions: Question[] = [];
    isAuthentificated: boolean;

    // Ces paramètres permettent d'asurer que les fonctionnalité de cette page sont bien implémentés et
    // les changer de fichier compliquerait le tout pour rien.
    // eslint-disable-next-line max-params
    constructor(
        public dialog: MatDialog,
        private formBuilder: FormBuilder,
        private changeDetector: ChangeDetectorRef, // to avoid ExpressionChangedAfterItHasBeenCheckedError
        private gameService: GameService,
        private route: ActivatedRoute,
        private communicationService: CommunicationService,
        private router: Router,
    ) {}

    ngAfterViewInit(): void {
        this.questionsBankList = this.questionsBankComponent.questionsBankList;
        this.changeDetector.detectChanges();
    }

    async ngOnInit() {
        this.initializeComponent();
    }

    async initializeComponent() {
        this.communicationService.sharedVariable$.subscribe((data) => {
            this.isAuthentificated = data;
        });
        this.routeUnauthenticatedUser();
        this.createGameForm();
        this.gameService.games = await this.gameService.getAllGames();
        this.setGameIdFromParams();
    }

    loadGameData(gameId: string): void {
        this.populateForm(this.gameService.getGameByID(gameId));
    }

    populateForm(game: Game): void {
        this.gameForm.setValue({
            title: game.title,
            description: game.description,
            duration: game.duration,
        });

        this.questions = [...(game.questions as Question[])];
    }

    openDialog(): void {
        const dialogRef = this.dialog.open(CreateQuestionDialogComponent, {});

        dialogRef.afterClosed().subscribe((result: Question) => {
            if (result) {
                this.questions.push(result);
            }
        });
    }

    dropQuestion(event: CdkDragDrop<Question[]>) {
        if (event.previousContainer === event.container) {
            dragDrop.moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
        } else {
            dragDrop.transferArrayItem(event.previousContainer.data, event.container.data, event.previousIndex, event.currentIndex);
        }
    }

    handleDeleteQuestion(index: number): void {
        this.questions.splice(index, 1);
    }

    handleSaveQuestion(updatedQuestion: Question, index: number): void {
        if (index >= 0 && index < this.questions.length) {
            this.questions[index] = updatedQuestion;
        }
    }

    saveQuiz(): void {
        this.game = {
            id: this.id,
            lastModification: new Date(),
            title: this.gameForm.value.title,
            description: this.gameForm.value.description,
            duration: this.gameForm.value.duration,
            questions: this.questions,
            isHidden: true,
        };

        this.gameService.addGame(this.game);
        this.router.navigate(['/admin']);
    }

    private createGameForm(): void {
        this.gameForm = this.formBuilder.group({
            title: ['', Validators.required],
            description: [''],
            duration: [null, [Validators.required, Validators.min(MIN_DURATION), Validators.max(MAX_DURATION)]],
        });
    }

    private routeUnauthenticatedUser(): void {
        if (!this.isAuthentificated) {
            this.router.navigate(['/home']);
        }
    }

    private setGameIdFromParams(): void {
        this.route.paramMap.subscribe(async (params) => {
            const gameId = params.get('id');
            if (gameId) {
                this.loadGameData(gameId);
                this.id = gameId;
            } else {
                this.id = v4();
            }
        });
    }
}
