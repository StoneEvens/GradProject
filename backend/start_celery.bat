@echo off
REM 進入虛擬環境（如果有的話）

REM 啟動 Celery Worker
celery -A gradProject worker --loglevel=info 