import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { JoinComponent } from './components/join/join.component';
import { WordcloudComponent } from './components/wordcloud/wordcloud.component';
import { PollService } from './services/poll.service';

const routes: Routes = [
  { path: '', pathMatch: 'full', component: JoinComponent },
  { path: 'wordcloud', component: WordcloudComponent, canActivate: [PollService] },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
