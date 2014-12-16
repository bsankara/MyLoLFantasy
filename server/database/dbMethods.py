# Database methods for working with the DB

import sqlite3 as lite
import json


def create_group(account, name, summoners, summoner_ids, creation_time):
  con = lite.connect("myLoLFantasy.db")

  with con:
    cur = con.cursor()

    db_state = {"group_id": 100}

    try:
      with open("dbState.json", "r") as fr:
        db_state = json.load(fr)
    except IOError as e:
      # If the file doesn't exist or isn't available, then we will just start over
      pass

    stats = {}

    i = 0
    for summoner in summoners:
      stats[summoner] = {}

      stats[summoner]["summonerId"] = summoner_ids[i]
      stats[summoner]["stats"] = {}

      stats[summoner]["stats"]["championsKilled"] = 0
      stats[summoner]["stats"]["numDeaths"] = 0
      stats[summoner]["stats"]["assists"] = 0
      stats[summoner]["stats"]["minionsKilled"] = 0
      stats[summoner]["stats"]["doubleKills"] = 0
      stats[summoner]["stats"]["tripleKills"] = 0
      stats[summoner]["stats"]["quadraKills"] = 0
      stats[summoner]["stats"]["pentaKills"] = 0
      stats[summoner]["stats"]["goldEarned"] = 0
      stats[summoner]["stats"]["totalDamageDealtToChampions"] = 0
      stats[summoner]["stats"]["totalHeal"] = 0
      stats[summoner]["stats"]["level"] = 0
      stats[summoner]["stats"]["turretsKilled"] = 0
      stats[summoner]["stats"]["wardKilled"] = 0
      stats[summoner]["stats"]["wardPlaced"] = 0
      stats[summoner]["stats"]["totalDamageTaken"] = 0
      stats[summoner]["stats"]["win"] = 0
      stats[summoner]["stats"]["totalGames"] = 0

      i += 1

    cur.execute("INSERT INTO T_DATA VALUES(?, ?, ?, ?, ?, ?)", (str(db_state["group_id"]), account, str(creation_time), json.dumps(stats), "", name))

    current_groups = get_groups_in(account)
    groups_text = "".join([str(group) + " " for group in current_groups])
    groups_text += str(db_state["group_id"])
    cur.execute("UPDATE T_ADMIN SET GroupsIn = ? WHERE Account = ?", (groups_text, account))

    db_state["group_id"] += 1
    with open("dbState.json", "w") as fw:
      json.dump(db_state, fw)

    con.commit()


def delete_group(group_id, account):
  con = lite.connect("myLoLFantasy.db")

  with con:
    cur = con.cursor()

    cur.execute("DELETE FROM T_DATA WHERE Group_ID = ?", (group_id,))

    # print(group_id)
    # print({group_id})

    account_groups = get_groups_in(account)
    # print(account_groups - {group_id})
    # print(account_groups, flush=True)
    account_groups = account_groups - {group_id}

    # print(account_groups, flush=True)

    groups_text = "".join([str(group) + " " for group in account_groups])
    groups_text = groups_text.strip()
    cur.execute("UPDATE T_ADMIN SET GroupsIn = ? WHERE Account = ?", (groups_text, account))

    con.commit()


def group_exists(group_id):
  con = lite.connect("myLoLFantasy.db")

  with con:
    cur = con.cursor()

    cur.execute("SELECT 1 FROM T_DATA WHERE Group_ID = ?", (group_id,))

    existCheck = cur.fetchone()
    if existCheck:
      return True
    else:
      return False


def get_all_groups():
  con = lite.connect("myLoLFantasy.db")

  with con:
    cur = con.cursor()
    cur.execute("SELECT Group_ID FROM T_DATA")
    data = cur.fetchall()
    retList = []
    for item in data:
      retList.append(item[0])

    return retList


def get_tracked_match_ids(group_id):
  con = lite.connect("myLoLFantasy.db")

  with con:
    cur = con.cursor()
    cur.execute("SELECT MatchesTracked FROM T_DATA WHERE Group_ID = ?", (str(group_id),))
    ret_set = set([])
    s = cur.fetchone()[0]
    if s:
      s = s.split()
      for num in s:
        num = num.strip()
        ret_set.add(int(num))

    return ret_set


def get_group_data(group_id):
  con = lite.connect("myLoLFantasy.db")

  with con:
    cur = con.cursor()
    cur.execute("SELECT Stats FROM T_DATA WHERE Group_ID = ?", (str(group_id),))
    data = cur.fetchone()

    data = json.loads(data[0])

    return data


def get_group_name(group_id):
  con = lite.connect("myLoLFantasy.db")

  with con:
    cur = con.cursor()
    cur.execute("SELECT Name FROM T_DATA WHERE Group_ID = ?", (str(group_id),))

    return cur.fetchone()[0]


def get_group_creator(group_id):
  con = lite.connect("myLoLFantasy.db")

  with con:
    cur = con.cursor()
    cur.execute("SELECT Creator FROM T_DATA WHERE Group_ID = ?", (str(group_id),))

    return cur.fetchone()[0]


def get_group_creation_time(group_id):
  con = lite.connect("myLoLFantasy.db")

  with con:
    cur = con.cursor()
    cur.execute("SELECT CreationTime FROM T_DATA WHERE Group_ID = ?", (str(group_id),))

    return int(cur.fetchone()[0])


def update_group_data(group_id, data):
  con = lite.connect("myLoLFantasy.db")

  with con:
    cur = con.cursor()
    cur.execute("UPDATE T_DATA SET Stats = ? WHERE Group_ID = ?", (json.dumps(data), str(group_id)))


def add_tracked_matches(group_id, data):
  con = lite.connect("myLoLFantasy.db")

  update_string = ""

  existing_matches = get_tracked_match_ids(group_id)

  with con:
    cur = con.cursor()

    for match in data:
      existing_matches.add(match)

    for match in existing_matches:
      update_string = update_string + str(match) + " "

    update_string = update_string.strip()

    cur.execute("UPDATE T_DATA SET MatchesTracked = ? WHERE Group_ID = ?", (str(update_string), str(group_id)))


def user_exists(account):
  con = lite.connect("myLoLFantasy.db")

  with con:
    cur = con.cursor()

    cur.execute("SELECT 1 FROM T_ADMIN WHERE Account = ?", (account,))

    existCheck = cur.fetchone()
    if existCheck:
      return True
    else:
      return False


def create_user(account, password_hash, lol_account):
  con = lite.connect("myLoLFantasy.db")

  with con:
    cur = con.cursor()

    cur.execute("INSERT INTO T_ADMIN VALUES(?, ?, ?, ?)", (account, lol_account, password_hash, ""))

    con.commit()


def get_password_hash(account):
  con = lite.connect("myLoLFantasy.db")

  with con:
    cur = con.cursor()

    cur.execute("SELECT PasswordHashes FROM T_ADMIN WHERE Account = ?", (account,))
    result = cur.fetchone()[0]
    return result


def get_lol_account(account):
  con = lite.connect("myLoLFantasy.db")

  with con:
    cur = con.cursor()

    cur.execute("SELECT LoL_account FROM T_ADMIN WHERE Account = ?", (account,))
    result = cur.fetchone()[0]
    return result


def get_groups_in(account):
  con = lite.connect("myLoLFantasy.db")

  with con:
    cur = con.cursor()

    cur.execute("SELECT GroupsIn FROM T_ADMIN WHERE Account = ?", (account,))
    groups = set([])
    s = cur.fetchone()[0]
    if s:
      group_list = s.split()
      for group in group_list:
        groups.add(int(group))

    return groups
