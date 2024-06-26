export interface Choices {
    text: string;
    isCorrect: boolean;
    index: number;
}

export enum Type {
    QCM = 'QCM',
    QRL = 'QRL',
}
export interface Question {
    id: string;
    type: Type;
    lastModification: Date | null;
    text: string;
    points: number;
    choices?: Choices[] | null;
}
export interface Game {
    id: string;
    title: string;
    pin?: string;
    description?: string;
    duration?: number;
    lastModification?: Date | null;
    questions: Question[];
    isHidden?: boolean;
    unavailable?: boolean;
}

export interface Player {
    name: string;
    isHost: boolean;
    isRandomGameHost?: boolean;
    id: string;
    score: number;
    bonusCount: number;
    leftGame: boolean;
    color?: number;
    chatEnabled?: boolean; // Active ou désactive le chat
}

export const YELLOW = 0xffff00;
export const BLACK = 0x000000;
export const RED = 0xff0000;
export const GREEN = 0x00ff00;

export const DEFAULT_PLAYER_PROFILE: Player = {
    id: '',
    name: 'Player',
    isHost: false,
    score: 0,
    bonusCount: 0,
    color: RED,
    chatEnabled: true,
    leftGame: false,
};

export const DEFAULT_HOST_PROFILE: Player = {
    name: 'Organisateur',
    score: 0,
    isHost: true,
    id: '',
    bonusCount: 0,
    color: GREEN,
    chatEnabled: true,
    leftGame: false,
};
