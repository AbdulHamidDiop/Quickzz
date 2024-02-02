import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { API_URL } from '@common/consts';
import { Game } from '@common/game';
import { GameService } from './game.service';

describe('GameService', () => {
    let service: GameService;

    beforeEach(() => {
        TestBed.configureTestingModule({});
        service = TestBed.inject(GameService);
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    it('should initialize with an empty array of games', () => {
        expect(service.games).toEqual([]);
    });

    it('getSelectedGame should return selectedGame', () => {
        const mockGame: Game = { id: '1', title: 'Game 1', questions: [] };
        service.selectGame(mockGame);

        const selectedGame = service.getSelectedGame();

        expect(selectedGame).toEqual(mockGame);
    });

    it('selectGame should set selectedGame', () => {
        const mockGame: Game = { id: '1', title: 'Game 1', questions: [] };

        service.selectGame(mockGame);

        expect(service.getSelectedGame()).toEqual(mockGame);
    });

    it('getAllGames should fetch games from API', fakeAsync(() => {
        const mockGames: Game[] = [
            { id: '1', title: 'Game 1', questions: [] },
            { id: '2', title: 'Game 2', questions: [] },
        ];
        spyOn(window, 'fetch').and.returnValue(Promise.resolve({ ok: true, json: async () => Promise.resolve(mockGames) } as Response));

        service.getAllGames();
        tick();

        expect(service.games).toEqual(mockGames);
    }));

    it('addGame should send a POST request to API', fakeAsync(() => {
        const mockGame: Game = { id: '1', title: 'Game 1', questions: [] };
        spyOn(window, 'fetch').and.returnValue(Promise.resolve(new Response(null, { status: 200, headers: { 'Content-type': 'application/json' } })));

        service.addGame(mockGame);
        tick();

        expect(window.fetch).toHaveBeenCalledWith(
            API_URL + 'game/importgame',
            jasmine.objectContaining({
                method: 'POST',
                body: JSON.stringify(mockGame),
            }),
        );
    }));

    it('getGameByID should fetch game by ID from all games', fakeAsync(() => {
        const mockGames: Game[] = [
            { id: '1', title: 'Game 1', questions: [] },
            { id: '2', title: 'Game 2', questions: [] },
        ];
        service.games = mockGames;

        const foundGame = service.getGameByID('1');
        tick();

        expect(foundGame).toEqual(mockGames[0]);
    }));

    it('toggleGameHidden should send a PATCH request to API', fakeAsync(() => {
        const mockGame: Game = { id: '1', title: 'Game 1', questions: [] };

        spyOn(window, 'fetch').and.returnValue(Promise.resolve(new Response(null, { status: 200, headers: { 'Content-type': 'application/json' } })));

        // Select the mock game before toggling hidden status
        service.selectGame(mockGame);
        service.toggleGameHidden('1');
        tick();

        expect(window.fetch).toHaveBeenCalledWith(
            API_URL + 'game/togglehidden',
            jasmine.objectContaining({
                method: 'PATCH',
                body: JSON.stringify({ id: '1' }),
            }),
        );

        // After toggling hidden status, the selected game's hidden status should be updated
        expect(service.getSelectedGame().isHidden).toBe(!mockGame.isHidden);
    }));

    it('deleteGameByID should send a DELETE request to API', fakeAsync(() => {
        spyOn(window, 'fetch').and.returnValue(Promise.resolve(new Response(null, { status: 204, statusText: 'No Content' })));

        service.deleteGameByID('1');
        tick();

        expect(window.fetch).toHaveBeenCalledWith(API_URL + 'game/deletegame/1', jasmine.objectContaining({ method: 'DELETE' }));
    }));
});
