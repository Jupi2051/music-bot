{ pkgs }: {
  deps = [
    pkgs.nodejs-18_x
    pkgs.ffmpeg
    pkgs.python3
    pkgs.nodePackages.typescript
    pkgs.yarn
    pkgs.openssh
  ];
}
