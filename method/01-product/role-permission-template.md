# Role and Permission Template

## Roles

| Role | Primary Responsibility | Device Context |
|---|---|---|
| Super Admin | Owns all configuration and access | Desktop/tablet |
| Property Admin | Manages property operations and reports | Desktop/tablet |
| Operations Manager | Coordinates daily room readiness and escalations | Mobile/tablet |
| Receptionist | Handles bookings, guests, payments, check-in/out | Desktop/tablet |
| Caretaker / Assistant | Updates room status, issues, guest requests | Mobile |
| Housekeeping | Completes cleaning tasks and checklists | Mobile |
| Maintenance | Resolves repairs and damage issues | Mobile |
| Restaurant Manager | Manages menu, orders, and kitchen flow | Tablet/desktop |
| Waiter | Creates and updates restaurant orders | Mobile/tablet |
| Chef / Kitchen | Updates kitchen order status | Tablet |
| Accountant | Reviews payments, exports, reports, tax | Desktop |
| Security | Views limited guest and room arrival data | Mobile |

## Permission Matrix

| Module | Super Admin | Admin | Ops Manager | Reception | Caretaker | Housekeeping | Restaurant | Finance |
|---|---|---|---|---|---|---|---|---|
| Dashboard | Full | Full | Ops | Front desk | Limited | Limited | Restaurant | Finance |
| Bookings | Full | Full | View | Manage | View | None | View room charges | View |
| Guests | Full | Full | View | Manage | Limited | None | Limited | View |
| Rooms | Full | Manage | Manage status | View | Update status | Update cleaning | View | View |
| Payments | Full | Full | View | Record | None | None | Record restaurant | Reconcile |
| Housekeeping | Full | Full | Manage | View | Update | Update | None | None |
| Assets | Full | Full | Manage | Checkout view | Update | Report issue | None | Value report |
| Inventory | Full | Full | View | None | Request | Request | Manage usage | Reports |
| Restaurant | Full | Full | View | Room charge view | None | None | Manage | Reports |
| Reports | Full | Full | Ops reports | Limited | None | None | Restaurant | Finance |
| Settings | Full | Manage | None | None | None | None | None | None |

