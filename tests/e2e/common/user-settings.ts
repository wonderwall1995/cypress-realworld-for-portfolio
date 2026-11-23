import { expect, Page, test } from "@playwright/test";
import { Profile } from "../fixture/random-profile";

/** 공통 코드: 사이드바의 "내 계정"을 눌러 설정 화면을 연다. 설정 칸이 보이면 끝난다. */
export async function openUserSettings(page: Page) {
  return test.step("[common] openUserSettings", async () => {
    await page.getByTestId("sidenav-user-settings").click();
    await expect(page).toHaveURL("/user/settings");
    await expect(page.getByTestId("user-settings-form")).toBeVisible();
  });
}

/**
 * 공통 코드: 설정 화면에 정보를 쓴다. 준 항목만 쓴다.
 * 쓰기만 한다: 안내가 나오는지, 저장 버튼이 꺼지는지는 부른 쪽이 판정한다.
 */
export async function fillUserSettings(page: Page, profile: Partial<Profile>) {
  return test.step("[common] fillUserSettings", async () => {
    for (const [item, value] of Object.entries(profile)) {
      await page.getByTestId(`user-settings-${item}-input`).fill(value);
    }
  });
}

/**
 * 공통 코드: 설정 화면에 정보를 쓰고 저장한다.
 * 저장됐다는 안내가 나오는 것으로 동작이 됐는지 확인한다. 저장된 값은 부른 쪽이 판정한다.
 */
export async function saveUserSettings(page: Page, profile: Profile) {
  return test.step("[common] saveUserSettings", async () => {
    await fillUserSettings(page, profile);
    await page.getByTestId("user-settings-submit").click();
    await expect(page.getByTestId("user-settings-message")).toHaveText("설정 저장 성공");
  });
}
