
# RemotePrint NG (Fresh Setup)

End-to-end demo: Static frontend + Azure Functions + Azure SQL + Azure Blob + JWT auth.

## Azure resources
- Static Web App (SWA) with integrated Functions
- Azure SQL (use `sql/schema.sql`)
- Storage account with container `jobs`

## Environment variables (SWA → Environment variables → API)
```
JWT_SECRET=your-super-long-random-secret
SQL_CONNECTION_STRING=Server=tcp:<server>.database.windows.net,1433;Initial Catalog=remoteprintdb;Persist Security Info=False;User ID=<user>;Password=<pass>;MultipleActiveResultSets=False;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;
AZURE_STORAGE_ACCOUNT_NAME=<storage-account-name>
AZURE_STORAGE_ACCOUNT_KEY=<the-key>
AZURE_STORAGE_CONTAINER=jobs
```

## Deploy
- Create a GitHub repo.
- Push this folder.
- Create a Static Web App pointing to `frontend` (app) and `api` (api).

## Smoke test
1) Sign up → Sign in.
2) Subscribe (Basic) → check `/api/me` reflects plan.
3) Upload file → should queue job and show in Job History.
