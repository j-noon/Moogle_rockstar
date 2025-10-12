from django.db import migrations

class Migration(migrations.Migration):
    # Keep your existing dependency that makemigrations generated for "core"
    # and add an auth dependency to ensure the auth_user table exists.
    dependencies = [
        ('core', '0006_alter_profile_profile_image'),
        ('auth', '0012_alter_user_first_name_max_length'),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
                -- Enforce case-insensitive uniqueness on TRIMMED, NON-BLANK emails.
                -- We cannot use NULL because your email column is NOT NULL, so we ignore blanks.
                CREATE UNIQUE INDEX IF NOT EXISTS auth_user_email_ci_unique
                ON auth_user (LOWER(TRIM(email)))
                WHERE LENGTH(TRIM(email)) > 0;
            """,
            reverse_sql="DROP INDEX IF EXISTS auth_user_email_ci_unique;"
        ),
    ]