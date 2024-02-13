import { Injectable } from '@angular/core';
import { API_URL } from '@common/consts';
import { Game } from '@common/game';
import { FetchService } from './fetch.service';

@Injectable({
    providedIn: 'root',
})
export class GameService {
    games: Game[] = [];
    // Modification : Déclaration de selectedGame comme Game directement
    private selectedGame: Game = {} as Game;

    constructor(public fetchService: FetchService) {
        this.getAllGames().then((games) => {
            this.games = games;
        });
    }

    // Modification : Modification du type de retour de getSelectedGame à Game
    getSelectedGame(): Game {
        return this.selectedGame;
    }

    selectGame(game: Game): void {
        this.selectedGame = game;
    }

    async getAllGames(): Promise<Game[]> {
        const response = await this.fetchService.fetch(API_URL + 'game');
        if (!response.ok) {
            throw new Error(`Error: ${response.status}`);
        }
        const games: Game[] = await response.json();
        return games;
    }

    async addGame(game: Game): Promise<void> {
        const response = await this.fetchService.fetch(API_URL + 'game/importgame', {
            method: 'POST',
            headers: {
                contentType: 'application/json',
            },
            body: JSON.stringify(game),
        });
        if (!response.ok) {
            throw new Error(`Error: ${response.status}`);
        }
    }

    getGameByID(id: string): Game {
        const game = this.games.find((g) => g.id === id);
        if (!game) {
            throw new Error('Game not found');
        }
        return game;
    }

    async toggleGameHidden(gameID: string): Promise<void> {
        const response = await this.fetchService.fetch(API_URL + 'game/togglehidden', {
            method: 'PATCH',
            headers: {
                contentType: 'application/json',
            },
            body: JSON.stringify({ id: gameID }),
        });
        if (!response.ok) {
            throw new Error(`Error: ${response.status}`);
        }
    }

    async deleteGameByID(id: string): Promise<boolean> {
        const response = await this.fetchService.fetch(API_URL + 'game/delete/' + id, {
            method: 'DELETE',
        });
        if (!response.ok) {
            throw new Error(`Error: ${response.status}`);
        }
        return true;
    }

    async getQuestionsWithoutCorrectShown(id: string): Promise<Game> {
        const response = await this.fetchService.fetch(API_URL + 'game/questionswithoutcorrect/' + id);
        if (!response.ok) {
            throw new Error(`Error: ${response.status}`);
        }
        const game: Game = await response.json();
        return game;
    }

    async checkAnswer(answer: string[], gameID: string, questionID: string): Promise<boolean> {
        try {
            const response = await this.fetchService.fetch(API_URL + 'game/check', {
                method: 'POST',
                headers: {
                    contentType: 'application/json',
                },
                body: JSON.stringify({ answer, gameID, questionID }),
            });

            if (!response.ok) {
                throw new Error(`Error: ${response.status}`);
            }
            const result = await response.json();
            return result.isCorrect;
        } catch (error) {
            return false;
        }
    }

    async checkHiddenOrDeleted(game: Game): Promise<boolean> {
        const response = await this.fetchService.fetch(API_URL + 'game/availability/' + game.id, {
            method: 'GET',
            headers: {
                contentType: 'application/json',
            },
        });
        if (!response.ok) {
            throw new Error(`Error: ${response.status}`);
        }
        const availability: boolean = await response.json();
        return availability;
    }
}

export { Game };
