# Implementation Checklist

Before coding:

- Confirm the story has acceptance criteria.
- Confirm role permissions.
- Confirm data model changes.
- Confirm UI states: loading, empty, error, success.
- Confirm mobile layout.
- Confirm offline behavior if applicable.
- Confirm audit logging if applicable.

During coding:

- Follow existing component and design-token patterns.
- Use typed API contracts.
- Keep domain logic out of UI components.
- Validate server-side permissions.
- Add useful tests based on risk.

Before merge:

- Run lint/type checks/tests.
- Verify dark and light mode.
- Verify mobile viewport behavior.
- Verify permission boundaries.
- Verify audit log creation.
- Verify no sensitive data leaks in logs or exports.

