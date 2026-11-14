import { expect, Page } from "@playwright/test";
import { expectNewBankAccount } from "../api/expect-bank-account";

// 실제 은행 이름을 조금씩 바꾼 가상의 은행 32곳: 한국풍 16곳 + 영미권풍 16곳. 계좌를 만들 때마다 이 중 하나를 무작위로 고른다
const BANK_NAMES = [
  // 한국풍
  "KP국민은행", "신환은행", "우리들은행", "하라은행", "NP농산은행", "IBQ기업은행", "SD제일은행", "한국씨트은행",
  "카카우뱅크", "케이방크", "토수뱅크", "부상은행", "광조은행", "전복은행", "제루은행", "수혁은행",
  // 영미권풍
  "JPMorgan Chess", "Bank of North America", "Wells Cargo", "Citibunk", "Goldmen Sacks", "Morgana Stanley", "U.S. Banc", "PMC Bank",
  "Truest", "Capital Won", "TB Bank", "HSBD", "Barkleys", "Floyds Bank", "NatEast", "Standard Chartreuse",
];

/**
 * 공통 코드: 무작위 은행 계좌 정보를 만든다.
 * - 은행 이름: 위 가상의 은행 32곳 중 하나를 무작위로 고른다 (1~32번 중 무작위).
 * - 계좌 번호: 무작위 숫자이고, 자리 수도 9~12자리 중에서 무작위로 정한다(앱은 9~12자리 숫자를 받는다).
 */
export function randomBankAccountInput() {
  const bankName = BANK_NAMES[Math.floor(Math.random() * BANK_NAMES.length)];
  const digits = 9 + Math.floor(Math.random() * 4); // 9, 10, 11, 12 중 하나
  const accountNumber = Array.from({ length: digits }, () => Math.floor(Math.random() * 10)).join("");
  return { bankName, accountNumber };
}

/**
 * 공통 코드: 은행 계좌 하나를 만든다. 만드는 일 전체를 한다.
 * 1) 화면의 은행 계좌 양식(/bankaccounts/new)으로 만든다. 계좌 정보는 무작위다.
 *    계좌가 만들어지면 앱이 계좌 목록(/bankaccounts)으로 보내므로, 주소로 성공을 판정한다.
 * 2) API로 그 계좌가 실제로 있고 금액이 0인지 확인한다.
 * 만든 계좌의 정보를 돌려준다.
 */
export async function createBankAccount(page: Page) {
  const account = randomBankAccountInput();

  await page.goto("/bankaccounts/new");
  await expect(page).toHaveURL("/bankaccounts/new");
  await page.getByTestId("bankaccount-bankName-input").locator("input").fill(account.bankName);
  await page.getByTestId("bankaccount-accountNumber-input").locator("input").fill(account.accountNumber);
  await page.getByTestId("bankaccount-submit").click();
  await expect(page).toHaveURL("/bankaccounts");

  await expectNewBankAccount(page, account);
  return account;
}
