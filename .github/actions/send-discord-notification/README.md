# Send Discord Notification

This GitHub composite action sends rich Discord messages using a webhook. It's based on [`sarisia/actions-status-discord`](https://github.com/sarisia/actions-status-discord) and is designed to be reusable inside workflows as a step.

## 📦 Features

- Sends customizable Discord messages
- Supports message status, embeds, avatars, titles, and more
- Easy to include in any job as a step
- Designed for monorepo workflows

## ✅ Usage

```yaml
- name: Send Discord Notification
  uses: ./.github/actions/send-discord-notification
  with:
    title: "New Release"
    description: "FastyBird Smart Panel has a new alpha release!"
    status: "Success"
    url: "https://smart-panel.fastybird.com"
  secrets:
    DISCORD_WEBHOOK: ${{ secrets.DISCORD_WEBHOOK_URL }}
```

## 💡 Inputs

| Name          | Description                                         | Default                             | Required |
|---------------|-----------------------------------------------------|-------------------------------------|----------|
| `status`      | Build status (e.g. Success, Failure)                | `Success`                           | ❌        |
| `content`     | Plain content message                               | `-`                                 | ❌        |
| `title`       | Embed title                                         | `-`                                 | ❌        |
| `description` | Embed description                                   | `-`                                 | ❌        |
| `image`       | Embed image URL                                     | `-`                                 | ❌        |
| `color`       | Embed color (hex or decimal)                        | `-`                                 | ❌        |
| `url`         | Embed link URL                                      | `https://smart-panel.fastybird.com` | ❌        |
| `username`    | Username to display in Discord                      | `FastyBird`                         | ❌        |
| `avatar-url`  | Avatar image URL                                    | `-`                                 | ❌        |
| `nofail`      | Whether to ignore failures in the step              | `true`                              | ❌        |
| `noprefix`    | Whether to remove the default prefix in the message | `false`                             | ❌        |
| `nodetail`    | Whether to hide job details in the message          | `false`                             | ❌        |
| `nocontext`   | Whether to hide repository/context information      | `false`                             | ❌        |
| `notimestamp` | Whether to omit timestamp from message              | `false`                             | ❌        |
| `webhook`     | The Discord webhook URL                             | `-`                                 | ✅        |


## 🛠 Included Steps

1. Uses `sarisia/actions-status-discord` to send messages
2. Can be dropped into any job step
3. Works well with other reusable workflows or composite actions
