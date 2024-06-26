// Nous avons besoin de la console afin de vérifier que les connections au database et au serveur s'établissent correctement
/* eslint-disable no-console */
import { Application } from '@app/app';
import { LAST_INDEX } from '@common/consts';
import { GREEN, Player, RED, YELLOW } from '@common/game';
import { ChatMessage } from '@common/message';
import { Events, LOBBY, Namespaces } from '@common/sockets';
import { DB_URL } from '@common/utils/env';
import { CorsOptions } from 'cors';
import * as http from 'http';
import { AddressInfo } from 'net';
import { Socket, Server as SocketIOServer } from 'socket.io';
import { Service } from 'typedi';
import { DatabaseService } from './services/database.service';
import { GameSessionService } from './services/game-session.service';
import { SocketEvents } from './services/socket-events.service';

@Service()
export class Server {
    private static readonly appPort: string | number | boolean = Server.normalizePort(process.env.PORT || '3000');
    private static readonly baseDix: number = 10;
    private server: http.Server;
    private io: SocketIOServer;
    private chatHistories: Map<string, ChatMessage[]> = new Map();
    private liveRooms: string[] = [];
    private randomGamesNumberOfAnswers = new Map<string, number>();

    // Le nombre de paramètres est adéquat pour les requis du projet
    // malgré les conventions de eslint
    // eslint-disable-next-line max-params
    constructor(
        private readonly application: Application,
        private socketEvents: SocketEvents,
        private gameSessionService: GameSessionService,
        private databaseService: DatabaseService,
    ) {}

    private static normalizePort(val: number | string): number | string | boolean {
        const port: number = typeof val === 'string' ? parseInt(val, this.baseDix) : val;
        return isNaN(port) ? val : port >= 0 ? port : false;
    }

    async init(): Promise<void> {
        this.application.app.set('port', Server.appPort);
        this.server = http.createServer(this.application.app);
        this.server.listen(Server.appPort);
        this.server.on('error', (error: NodeJS.ErrnoException) => this.onError(error));
        this.server.on('listening', () => this.onListening());
        const corsOptions: CorsOptions = { origin: '*' };
        this.io = new SocketIOServer(this.server, { cors: corsOptions });
        this.liveRooms.push(LOBBY);
        this.chatHistories.set(LOBBY, []);
        this.configureGlobalNamespace();
        this.configureStaticNamespaces();
        try {
            await this.databaseService.start(DB_URL);
            console.log('Database connection successful !');
        } catch {
            console.error('Database connection failed !');
            process.exit(1);
        }
    }

    private configureGlobalNamespace(): void {
        this.io.on('connection', (socket: Socket) => {
            socket.join(LOBBY);
            this.socketEvents.listenForEvents(socket);
        });
    }

    private configureStaticNamespaces(): void {
        const chatNamespace = this.io.of(`/${Namespaces.CHAT_MESSAGES}`);
        const waitingRoomNamespace = this.io.of(`/${Namespaces.WAITING_ROOM}`);
        const gameStatsNamespace = this.io.of(`/${Namespaces.GAME_STATS}`);
        const gameNamespace = this.io.of(`/${Namespaces.GAME}`);

        chatNamespace.on('connection', (socket) => {
            this.setupDefaultJoinRoomEvent(socket);
            socket.on(Events.CHAT_MESSAGE, (data) => {
                if (data.author === 'Système') {
                    this.io.to(data.room).emit(Events.CHAT_MESSAGE, data);
                } else {
                    socket.to(data.room).emit(Events.CHAT_MESSAGE, data);
                }
                const chatMessage: ChatMessage = { author: data.author, message: data.message, timeStamp: data.timeStamp };
                if (!this.chatHistories.has(data.room)) this.chatHistories.set(data.room, [chatMessage]);
                else this.chatHistories.set(data.room, this.chatHistories.get(data.room).concat(chatMessage));
            });

            socket.on(Events.CHAT_HISTORY, (data) => {
                const chatHistory = this.chatHistories.get(data.room) || [];
                socket.to(data.room).emit(Events.CHAT_HISTORY, chatHistory);
                socket.emit(Events.CHAT_HISTORY, chatHistory);
            });
        });

        waitingRoomNamespace.on('connection', (socket) => {
            this.setupDefaultJoinRoomEvent(socket);
            socket.on(Events.JOIN_ROOM, ({ room, username }) => {
                socket.to(room).emit(Events.WAITING_ROOM_NOTIFICATION, `${username} a rejoint la salle d'attente`);
            });
        });

        gameStatsNamespace.on('connection', (socket) => {
            this.setupDefaultJoinRoomEvent(socket);
            socket.on(Events.QCM_STATS, (data) => {
                socket.to(data.room).emit(Events.QCM_STATS, data);
                this.setPlayerColor(data.room, data.player, YELLOW);
                this.gameSessionService.updateStatisticsData(data.room, data);
            });
            socket.on(Events.CONFIRM_ANSWERS, (data) => {
                this.setPlayerColor(data.room, data.player, GREEN);
                gameNamespace.to(data.room).emit(Events.PLAYER_CONFIRMED);
            });

            socket.on(Events.NOTIFY_QRL_INPUT, (data) => {
                this.setPlayerColor(data.room, data, YELLOW);
            });

            socket.on(Events.QRL_STATS, (data) => {
                gameStatsNamespace.to(data.room).emit(Events.QRL_STATS, data);
            });

            socket.on(Events.GAME_RESULTS, (data) => {
                gameStatsNamespace.to(data.room).emit(Events.GAME_RESULTS, data);
            });

            socket.on(Events.UPDATE_CHART, (data) => {
                gameStatsNamespace.to(data.room).emit(Events.UPDATE_CHART);
            });

            socket.on(Events.UPDATE_PLAYER, (data) => {
                gameStatsNamespace.to(data.room).emit(Events.UPDATE_PLAYER, data);
                this.setPlayerColor(data.room, data, RED);
            });

            socket.on(Events.GET_PLAYERS, (data) => {
                gameStatsNamespace.to(data.room).emit(Events.GET_PLAYERS, data);
            });

            socket.on(Events.GET_STATS, async (data) => {
                const stats = await this.gameSessionService.getStatisticsData(data.room);
                socket.emit(Events.GET_STATS, stats);
            });

            socket.on(Events.STORE_PLAYER, async (data) => {
                await this.gameSessionService.storePlayer(data.room, data);
                const players = await this.gameSessionService.getPlayers(data.room);
                socket.emit(Events.GET_FINAL_PLAYERS, players);
            });

            socket.on(Events.GET_FINAL_PLAYERS, async (data) => {
                const players = await this.gameSessionService.getPlayers(data.room);
                socket.emit(Events.GET_FINAL_PLAYERS, players);
            });
        });

        gameNamespace.on('connection', (socket) => {
            this.setupDefaultJoinRoomEvent(socket);
            socket.on(Events.SHOW_RESULTS, ({ room }) => {
                gameNamespace.in(room).emit(Events.SHOW_RESULTS);
            });

            socket.on(Events.PLAYER_LEFT, (data) => {
                const playersInRoom = this.socketEvents.mapOfPlayersInRoom.get(data.room) || [];
                const player = playersInRoom.find((play) => play.name === data.user);
                if (player) {
                    player.leftGame = true;
                }
                gameNamespace.in(data.room).emit(Events.PLAYER_LEFT, data);
                const playersInGame = this.socketEvents.mapOfPlayersInRoom.get(data.room)?.filter((play) => !play.leftGame);
                if (!playersInGame?.length) {
                    this.randomGamesNumberOfAnswers.delete(data.room);

                    const index = this.liveRooms.indexOf(data.room);
                    if (index > LAST_INDEX) this.liveRooms.splice(index, 1);

                    this.chatHistories.delete(data.room);

                    this.gameSessionService.deleteSession(data.room);
                }
            });

            socket.on(Events.PLAYER_JOINED, (data) => {
                gameNamespace.in(data.room).emit(Events.PLAYER_JOINED, data);
            });

            socket.on(Events.NEXT_QUESTION, ({ room }) => {
                gameNamespace.to(room).emit(Events.NEXT_QUESTION);
            });

            socket.on(Events.QRL_ANSWER, (data) => {
                socket.in(data.room).emit(Events.QRL_ANSWER, data);
            });

            socket.on(Events.SEND_QRL_ANSWER, ({ room }) => {
                gameNamespace.to(room).emit(Events.SEND_QRL_ANSWER);
            });

            socket.on(Events.QRL_GRADE, (data) => {
                socket.in(data.room).emit(Events.QRL_GRADE, data);
                this.gameSessionService.updateQRLGradeData(data.room, data);
            });

            socket.on(Events.END_GAME, ({ room }: { room: string }) => {
                gameNamespace.in(room).emit(Events.END_GAME);
            });

            socket.on(Events.CLEANUP_GAME, ({ room }: { room: string }) => {
                gameNamespace.in(room).emit(Events.CLEANUP_GAME);

                const index = this.liveRooms.indexOf(room);
                if (index > LAST_INDEX) this.liveRooms.splice(index, 1);

                this.chatHistories.delete(room);

                this.gameSessionService.deleteSession(room);
            });

            socket.on(Events.ABORT_GAME, ({ room }: { room: string }) => {
                gameNamespace.in(room).emit(Events.ABORT_GAME);
            });

            socket.on(Events.START_TIMER, (data) => {
                gameNamespace.in(data.room).emit(Events.START_TIMER, data);
            });

            socket.on(Events.STOP_TIMER, ({ room }) => {
                gameNamespace.in(room).emit(Events.STOP_TIMER);
            });
            socket.on(Events.PAUSE_TIMER, ({ room }) => {
                gameNamespace.in(room).emit(Events.PAUSE_TIMER);
            });

            socket.on(Events.PANIC_MODE, (data) => {
                gameNamespace.in(data.room).emit(Events.PANIC_MODE, data);
            });

            socket.on(Events.PANIC_MODE_OFF, ({ room }) => {
                gameNamespace.to(room).emit(Events.PANIC_MODE_OFF);
            });

            socket.on(Events.FINAL_ANSWER, ({ room }: { room: string }) => {
                socket.emit(Events.BONUS);
                socket.to(room).emit(Events.BONUS_GIVEN);
            });

            socket.on(Events.CONFIRM_ANSWER_R, async ({ room }) => {
                const numberOfAnswers = this.randomGamesNumberOfAnswers.get(room) + 1 || 1;
                this.randomGamesNumberOfAnswers.set(room, numberOfAnswers);
                const nPlayers = this.socketEvents.mapOfPlayersInRoom.get(room)?.filter((player) => !player.leftGame).length || 0;
                if (numberOfAnswers >= nPlayers) {
                    this.randomGamesNumberOfAnswers.set(room, 0);
                    gameNamespace.to(room).emit(Events.NEXT_QUESTION);
                }
            });

            socket.on(Events.RESET_NUMBER_ANSWERS, ({ room }) => {
                if (this.randomGamesNumberOfAnswers.get(room) > 0) {
                    this.randomGamesNumberOfAnswers.set(room, 0);
                }
            });
        });
    }

    private setupDefaultJoinRoomEvent(socket: Socket) {
        socket.on(Events.JOIN_ROOM, ({ room }: { room: string }) => {
            socket.join(room);
        });
    }

    private onError(error: NodeJS.ErrnoException): void {
        if (error.syscall !== 'listen') throw error;
        const bind: string = typeof Server.appPort === 'string' ? 'Pipe ' + Server.appPort : 'Port ' + Server.appPort;
        switch (error.code) {
            case 'EACCES':
                console.error(`${bind} requires elevated privileges`);
                process.exit(1);
                break;
            case 'EADDRINUSE':
                console.error(`${bind} is already in use`);
                process.exit(1);
                break;
            default:
                throw error;
        }
    }
    private onListening(): void {
        const addr = this.server.address() as AddressInfo;
        const bind: string = typeof addr === 'string' ? `pipe ${addr}` : `port ${addr.port}`;
        console.log(`Listening on ${bind}`);
    }

    private setPlayerColor(room: string, player: Player, color: number) {
        const playerMap = this.socketEvents.mapOfPlayersInRoom.get(room);
        if (playerMap) {
            for (const play of playerMap) {
                if (player.name === play.name) {
                    play.color = color;
                    play.score = player.score;
                }
            }
            this.io.to(room).emit(Events.GET_PLAYERS, playerMap);
        }
    }
}
