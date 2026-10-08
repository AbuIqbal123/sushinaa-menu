// The e2e admin account. playwright.config.ts makes it up for each run and
// hands it to the server it starts, so no credential lives in the repository.
export const admin = {
  username: process.env.CMS_ADMIN_USERNAME ?? "",
  password: process.env.CMS_ADMIN_PASSWORD ?? "",
};
