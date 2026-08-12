# Admin Panel Access

The Admin Panel uses **two separate security checks**. First, authenticate through Manus OAuth using the Google or Manus identity for `rosidulshah4@gmail.com`. The application synchronizes that identity into Neon and assigns it the `admin` role. Next, open `/admin-panel-secret-access` and enter the configured Administrator Username and Administrator Password.

The administrator credential is checked server-side against the Neon `adminUsername` and `adminPasswordHash` fields. The password is never stored in plaintext or returned by the API. Do not share the configured password in public messages or source code.

If OAuth sign-in creates a new account row, the user sync logic recognizes `rosidulshah4@gmail.com` as the designated administrator and preserves the `admin` role during subsequent sign-ins.
