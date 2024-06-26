/* eslint-disable @typescript-eslint/no-explicit-any */
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NO_ERRORS_SCHEMA } from '@angular/core';
import { SocketRoomService } from '@app/services/socket-room.service';
import { SelectRoomComponent } from './select-room.component';
import SpyObj = jasmine.SpyObj;

describe('SelectRoomComponent', () => {
    let component: SelectRoomComponent;
    let fixture: ComponentFixture<SelectRoomComponent>;

    let socketMock: SpyObj<SocketRoomService>;
    beforeEach(async () => {
        socketMock = jasmine.createSpyObj('SocketRoomService', ['joinRoom', 'joinAllNamespaces']);
        await TestBed.configureTestingModule({
            declarations: [SelectRoomComponent],
            providers: [{ provide: SocketRoomService, useValue: socketMock }],
            schemas: [NO_ERRORS_SCHEMA],
        }).compileComponents();
    });

    beforeEach(() => {
        fixture = TestBed.createComponent(SelectRoomComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('Should call socket.joinRoom on call to joinRoom', () => {
        component.joinRoom({ value: '09211' } as HTMLInputElement);
        expect(socketMock.joinRoom).toHaveBeenCalled();
    });

    it('Should restrict input', () => {
        const target = { value: '09211' } as any;
        const event: Event = { target } as Event;

        component.restrictInput(event);
        expect(target.value).toEqual('0921');
    });
});
