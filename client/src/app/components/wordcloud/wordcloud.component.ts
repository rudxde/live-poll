import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { PollService } from '../../services/poll.service';
import { PollState } from 'live-poll-shared';
import * as Wordcloud from 'wordcloud';
import { takeUntil } from 'rxjs/operators';
import { FormControl, Validators } from '@angular/forms';
import { Router } from '@angular/router';

@Component({
  selector: 'app-wordcloud',
  templateUrl: './wordcloud.component.html',
  styleUrls: ['./wordcloud.component.scss']
})
export class WordcloudComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('canvas', { read: ElementRef, static: false })
  canvas: ElementRef<HTMLCanvasElement> | undefined;

  messageControl: FormControl = new FormControl('', [Validators.required])

  memberCount$: Observable<number> = this.pollService.memberCount$;

  words: PollState = [];

  destroy$ = new Subject<void>();


  constructor(
    private pollService: PollService,
    private router: Router,
  ) { }

  ngOnInit(): void {
  }


  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  ngAfterViewInit(): void {
    this.draw();
    this.pollService.state$
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: x => {
          this.words = x
          this.draw();
        }
      })
  }

  draw() {
    if (!this.canvas) {
      console.error('no canvas');
      return;
    }
    this.canvas.nativeElement.width = window.innerWidth * 0.9;
    this.canvas.nativeElement.height = window.innerHeight * 0.8;
    const largestWordSize = this.words.reduce((acc, [_, size]) => size > acc ? size : acc, 0);
    Wordcloud(this.canvas.nativeElement, {
      gridSize: Math.round(32 * this.canvas.nativeElement.width / 512),
      weightFactor: (size) => {
        // return Math.pow(size, 2.5) * this.canvas!.nativeElement.width / 1024 * 2;
        // return 50 + Math.pow(size, 2.5) * this.canvas!.nativeElement.width / 1024;
        // return 50 * Math.sqrt(size) * this.canvas!.nativeElement.width / 1024;
        return 265 / powerFraction(this.words.length, 2) / powerFraction(largestWordSize, 2) * powerFraction(size, 1.5) * this.canvas!.nativeElement.width / 1024;
      },
      fontFamily: 'Sans-Serif',
      color: (word, weight) => {
        const colors = ['#BC2929', '#BC2929', '#197171', '#219621'];
        return colors[Math.floor(Math.random() * colors.length)];
      },
      rotateRatio: 0.3,
      ...<any>{ rotationSteps: 2 },
      clearCanvas: true,
      // backgroundColor: '#000000',
      list: this.words,
      shrinkToFit: true,
    });
  }


  send() {
    if (!this.messageControl.valid) {
      return;
    }
    this.pollService.post(this.messageControl.value);
  }
  clear() {
    this.pollService.clear();
  }
  publish() {
    this.pollService.publish();
  }
  leave() {
    this.pollService.disconnect();
    this.router.navigateByUrl('/');
  }
}

function powerFraction(base: number, fraction: number): number {
  return Math.pow(base, (1 / fraction));
}

