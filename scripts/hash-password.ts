import { hashPassword } from "../src/lib/auth-core";

const passwordArgument = process.argv
  .slice(2)
  .find((argument) => argument !== "--");

if (!passwordArgument) {
  console.error('用法：pnpm auth:hash -- "你的管理员密码"');
  process.exit(1);
}

async function main(password: string): Promise<void> {
  try {
    console.log(await hashPassword(password));
  } catch (error) {
    console.error(error instanceof Error ? error.message : "密码哈希生成失败");
    process.exitCode = 1;
  }
}

void main(passwordArgument);
