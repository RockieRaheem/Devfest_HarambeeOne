import argparse
import json
from pathlib import Path

from sqlalchemy.orm import Session

from harambeeone_api.database import get_engine
from harambeeone_api.identity_migration import migrate_users, parse_export


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Idempotently import a protected Supabase Auth export into Firebase Auth."
    )
    parser.add_argument("source", type=Path, help="Path to the protected Supabase Auth JSON export")
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Perform the Firebase import and identity mapping; default is validation only",
    )
    args = parser.parse_args()
    users = parse_export(args.source)
    if not args.apply:
        print(
            json.dumps(
                {
                    "validated": len(users),
                    "bcrypt_passwords": sum(user.password_hash is not None for user in users),
                    "google_identities": sum(bool(user.provider_data) for user in users),
                    "password_reset_required": sum(user.requires_password_reset for user in users),
                    "applied": False,
                }
            )
        )
        return
    with Session(get_engine()) as session:
        result = migrate_users(users, session)
    print(json.dumps({**result, "applied": True}))


if __name__ == "__main__":
    main()
