# AngorHub

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 19.0.5.

## Development server

To start the Hub and the Blazor payment app together, run:

```bash
npm start
```

Open the Hub at `http://localhost:4200/`. The Blazor app runs at `http://localhost:5062/`, matching the Hub's development payment links. Both apps watch for source changes. Press Ctrl+C to stop both servers.

The launcher expects the Blazor checkout at `../angor-blazor` and a .NET 8 SDK. It uses `~/.local/share/angor-dotnet/dotnet` when an SDK is installed there, otherwise `dotnet` from your PATH. Set `ANGOR_BLAZOR_PROJECT` to a different `.csproj` path or `ANGOR_DOTNET` to a different `dotnet` executable if needed.

Use `npm run start:hub` to run only Angular. Angular options can still be passed through, for example `npm start -- --host 0.0.0.0`.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Karma](https://karma-runner.github.io) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.

# Docker

To run the Docker container locally:

```sh
docker run -p 3000:3000 blockcore/angor-hub:latest
```
