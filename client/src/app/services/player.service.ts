import { Injectable } from '@angular/core';
import { Player } from '@common/game';

@Injectable({
    providedIn: 'root',
})
export class PlayerService {
    player: Player = {
        name: '',
        isHost: false,
        id: '',
        score: 0,
        bonusCount: 0,
    };

    playersInGame: Player[] = [];

    setGamePlayers(players: Player[]): void {
        // adds only the players that are not already in the list
        players.forEach((player) => {
            const index = this.playersInGame.findIndex((pl) => pl.name === player.name);
            if (index < 0) {
                this.playersInGame.push(player);
            }
        });
    }

    addGamePlayers(player: Player): void {
        const index = this.playersInGame.findIndex((pl) => pl.name === player.name);
        if (index >= 0) {
            this.playersInGame[index] = player;
        } else {
            this.playersInGame.push(player);
        }
    }

    resetGamePlayers(): void {
        this.playersInGame = [];
    }
}
