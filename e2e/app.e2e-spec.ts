import { TourofheroesPage } from './app.po';

describe('tourofheroes App', () => {
  let page: TourofheroesPage;

  beforeEach(() => {
    page = new TourofheroesPage();
  });

  it('should display message saying app works', () => {
    page.navigateTo();
    expect(page.getParagraphText()).toEqual('app works!');
  });
});
