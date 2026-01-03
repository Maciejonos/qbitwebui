{
  pkgs,
  bun2nix,
  wrappers,
}: let
  package = bun2nix.writeBunApplication {
    packageJson = ./package.json;
    src = ./.;
    buildPhase = ''
      bun run build
      bun build --minify --target=bun ./src/server/index.ts --outfile=bin/qbitwebui-server
    '';
    startScript = ''
      bun run start
    '';
    bunDeps = bun2nix.fetchBunDeps {
      bunNix = ./bun.nix;
    };
  };
in
  wrappers.lib.wrapPackage {
    inherit pkgs package;
    env = {
      DATABASE_PATH = "$HOME/.local/share/qbitwebui/data";
      SALT_PATH = "$HOME/.local/share/qbitwebui/data";
      PORT = 8182;
      NODE_ENV = "production";
    };
  }
