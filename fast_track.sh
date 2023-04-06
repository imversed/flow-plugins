#!/bin/sh

yarn deploy
git add . && git commit -m '---' && git push
