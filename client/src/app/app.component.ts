import { AfterViewInit, Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { FormControl } from '@angular/forms';
import { tickStep } from 'd3';
import * as Wordcloud from 'wordcloud';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit, AfterViewInit {


  @ViewChild('canvas', { read: ElementRef, static: false })
  canvas: ElementRef<HTMLCanvasElement> | undefined;

  messages: string[] = [];
  websocket: WebSocket | undefined;
  text: FormControl = new FormControl('');
  words: [string, number][] = [];

  ngOnInit(): void {
    this.connect();
    window.addEventListener('resize', () => this.draw());
  }

  private connect() {
    let keepaliveIntervall: NodeJS.Timeout;
    this.websocket = new WebSocket("ws://localhost:80/");
    this.websocket.onmessage = (event) => {
      if (event.data === "connected") {
        keepaliveIntervall = setInterval(() => {
          this.websocket!.send('keepalive');
        }, 1000);
      } else {
        // this.messages.push(event.data);
        this.words = JSON.parse(event.data);
        this.draw();
      }
    };
    this.websocket.onclose = this.websocket.onerror = (() => {
      this.websocket?.close();
      if (keepaliveIntervall) {
        clearInterval(keepaliveIntervall);
      }
      setTimeout(() => {
        this.connect();
      }, 1000);
    });
  }

  ngAfterViewInit(): void {
    this.draw();
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
      drawMask: true,
    });
  }

  send(): void {
    this.websocket!.send(this.text.value);
    this.text.setValue('');
  }
  clear(): void {
    this.websocket!.send('clear');
  }
}

function powerFraction(base: number, fraction: number): number {
  return Math.pow(base, (1 / fraction));
}
