import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: `
    <h1>Pathfinder Rule Explorer</h1>
    <router-outlet />
  `,
  styles: [`
    h1 {
      text-align: center;
      color: #1976d2;
      margin: 2rem 0;
    }
  `]
})
export class AppComponent {
  title = 'Pathfinder Rule Explorer';
}
