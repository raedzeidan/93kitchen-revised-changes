import { createAuthClient } from "@neon/auth";

let client;
function auth(baseURL) {
  return client || (client = createAuthClient(baseURL));
}
export async function startGoogle(baseURL) {
  const callback = new URL("/", location.origin);
  callback.searchParams.set("kitchen_social", "1");
  const { error } = await auth(baseURL).signIn.social({
    provider: "google",
    callbackURL: callback.href,
    errorCallbackURL: location.origin + "/#/login/unavailable",
  });
  if (error) throw Error("تعذّر فتح Google. حاول مرة ثانية.");
}

export async function finishGoogle(baseURL) {
  const connection = auth(baseURL);
  const session = await connection.getSession();
  if (!session.data?.user) throw Error("تعذّر تأكيد حساب Google.");
  const result = await connection.token();
  if (!result.data?.token) throw Error("انتهت جلسة Google.");
  return result.data.token;
}
export async function closeGoogle(baseURL) {
  if (baseURL) await auth(baseURL).signOut();
}
