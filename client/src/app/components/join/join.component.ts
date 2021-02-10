import { Component, OnInit } from '@angular/core';
import { FormControl, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { PollService } from 'src/app/services/poll.service';

@Component({
  selector: 'app-join',
  templateUrl: './join.component.html',
  styleUrls: ['./join.component.scss']
})
export class JoinComponent implements OnInit {

  codeControl: FormControl = new FormControl('', [Validators.required])

  constructor(
    private pollService: PollService,
    private router: Router,
  ) { }

  ngOnInit(): void {
  }

  join() {
    if (!this.codeControl.valid) {
      return;
    }
    this.pollService.connect(this.codeControl.value);
    this.router.navigateByUrl('/wordcloud');
  }

}
