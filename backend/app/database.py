"""Database bootstrap — MongoDB via Motor."""
from . import store

init_db = store.init_db
close_db = store.close_db
check_db_alive = store.check_db_alive
get_db = store.get_db
