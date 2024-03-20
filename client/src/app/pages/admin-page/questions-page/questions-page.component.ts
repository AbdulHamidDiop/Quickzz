import { Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { CreateQuestionDialogComponent } from '@app/components/create-question-dialog/create-question-dialog.component';
import { CommunicationService } from '@app/services/communication.service';
import { QuestionsService } from '@app/services/questions.service';
import { Question } from '@common/game';

@Component({
    selector: 'app-questions-page',
    templateUrl: './questions-page.component.html',
    styleUrls: ['./questions-page.component.scss'],
})
export class QuestionsPageComponent implements OnInit {
    questions: Question[];
    isAuthentificated: boolean;

    // On a besoin de ces paramètres, notamment des élèments d'angular.
    constructor(
        public dialog: MatDialog,
        readonly communicationService: CommunicationService,
        readonly router: Router,
        readonly questionsService: QuestionsService,
    ) {}

    async getQuestions() {
        this.questions = await this.questionsService.getAllQuestions();
    }

    async ngOnInit() {
        this.communicationService.sharedVariable$.subscribe((data) => {
            this.isAuthentificated = data;
        });
        if (!this.isAuthentificated) {
            this.router.navigate(['/home']);
        }
        await this.getQuestions();
        this.questionsService.deleteRequest.subscribe(() => {
            this.getQuestions();
        });
    }
    openDialog(): void {
        const dialogRef = this.dialog.open(CreateQuestionDialogComponent, {});

        dialogRef.afterClosed().subscribe((result: Question) => {
            if (result) {
                this.questions.push(result);
            }
        });
    }
}
