import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Routes, RouterModule } from '@angular/router';

import { IonicModule } from '@ionic/angular';

import { PicknotePopoverPage } from './picknote-popover.page';
import {ApplicationPipesModule} from "../../../pipes/application-pipes";

const routes: Routes = [
  {
    path: '',
    component: PicknotePopoverPage
  }
];

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
      ApplicationPipesModule,
    RouterModule.forChild(routes)
  ],
  declarations: [PicknotePopoverPage]
})
export class PicknotePopoverPageModule {}
