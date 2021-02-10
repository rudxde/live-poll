import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, RouterStateSnapshot, UrlTree } from '@angular/router';
import { PollSettings, SetConfigurationCommand, ClearCommand, PostCommand, MemberCountCommand, StateCommand, PollState, isCommand } from 'live-poll-shared';
import { BehaviorSubject, interval, Observable, Subject } from 'rxjs';
import { catchError, switchMap, take, takeUntil } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class PollService implements CanActivate {

  public state$: Subject<PollState> = new Subject();
  public memberCount$: Subject<number> = new Subject();
  public disconnect$: Subject<void> = new Subject();
  public connected$ = new BehaviorSubject<boolean>(false);

  private webSocketIn$: Subject<string> = new Subject();
  private webSocketOut$: Subject<string> = new Subject();
  constructor() { 
    (window as any)['setPollSettings'] = (set: Partial<PollSettings>) => this.setSettings(set);
  }


  connect(id: string) {
    this.createConnection(id).pipe(
      catchError((err, caught) => {
        console.error(err);
        return interval(1000).pipe(take(1), switchMap(() => caught))
      }),
      takeUntil(this.disconnect$)
    ).subscribe();
    this.webSocketIn$
      .pipe(takeUntil(this.disconnect$))
      .subscribe({
        next: x => {
          const command = JSON.parse(x);
          if (!isCommand(command)) {
            console.error(`unexpected message: ${x}`);
            return;
          }
          switch (command.command) {
            case 'state':
              this.state$.next(command.state);
              break;
            case 'members':
              this.memberCount$.next(command.members);
              break;
            default:
              console.warn(`unknown command: ${x}`);
          }
        }
      });
    this.connected$.next(true);
  }

  disconnect() {
    this.disconnect$.next();
    this.connected$.next(false);
  }

  post(message: string) {
    const command: PostCommand = {
      command: 'post',
      message: message,
    }
    this.webSocketOut$.next(JSON.stringify(command));
  }

  setSettings(settings: Partial<PollSettings>) {
    const command: Partial<SetConfigurationCommand> = {
      command: 'set-configuration',
      ...settings,
    }
    this.webSocketOut$.next(JSON.stringify(command));
  }

  clear() {
    const command: ClearCommand = {
      command: 'clear'
    }
    this.webSocketOut$.next(JSON.stringify(command));
  }

  publish() {
    const command: Partial<SetConfigurationCommand> = {
      command: 'set-configuration',
      isPublished: true,
    }
    this.webSocketOut$.next(JSON.stringify(command));
  }


  private endpoint(id: string): string {
    const protocol = window.location.protocol.startsWith("https") ? "wss://" : "ws://";
    return protocol + window.location.hostname + '/api/' + id;
  }

  private createConnection(id: string): Observable<string> {
    console.debug('creating new Websocket connection');
    const closeConnection = new Subject<void>();
    return new Observable(observer => {
      const websocket = new WebSocket(this.endpoint(id));
      this.webSocketOut$.pipe(takeUntil(closeConnection)).subscribe({
        next: (x) => {
          console.debug(`send message: ${x}`);
          if (websocket.readyState > 1) {
            console.debug(`websocket is already closed :/`);
            observer.error(new Error("websocket CLOSED or CLOSING"));
            // this.webSocketOut$.next(x);
            return;
          }
          websocket.send(x);
        }
      });
      websocket.onopen = () => {
        interval(1000)
          .pipe(takeUntil(closeConnection))
          .subscribe({ next: () => websocket.send('keepalive') })
      }
      websocket.onmessage = (event) => {
        console.debug(`got message from websocket: ${event.data}`);
        this.webSocketIn$.next(event.data);
      };
      websocket.onclose = () => observer.complete();
      websocket.onerror = (event) => observer.error(event);
      return (() => {
        console.debug(`Teardown Websocket`)
        closeConnection.next();
        closeConnection.complete();
        if (websocket.readyState < 2) {
          websocket.close();
        }
      });
    });
  }

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean | UrlTree | Observable<boolean | UrlTree> | Promise<boolean | UrlTree> {
    return this.connected$;
  }
}
