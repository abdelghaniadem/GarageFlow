# Database Migrations Documentation — GarageFlow

This directory documents the planned schema evolution strategies for `garageflow_db`.

---

## Strict Migration Guidelines

1. **Baseline Invariance**:
   - The initial version of GarageFlow relies strictly on the existing 9 database tables (`utilisateur`, `client`, `vehicule`, `mecanicien`, `reparation`, `piece_detachee`, `reparation_piece`, `facture`, `rendez_vous`).
   - No SQL migrations are executed during Milestone 1 or initial development phases.

2. **Planned Future Migrations**:
   - **Migration V2 (Client Email & Vehicle Motorisation)**:
     - Will introduce `email` (varchar 120, nullable) to table `client`.
     - Will introduce `motorisation` (varchar 50, nullable) to table `vehicule`.
     - Scripts (`V2__add_client_email_and_vehicle_motorisation.sql` and corresponding rollback script) will be drafted, reviewed, and validated in a designated future milestone before any execution.

3. **Safety & Execution Rules**:
   - Every migration must be transactional (`BEGIN; ... COMMIT;`).
   - Every migration must have a tested, reversible rollback script.
   - A complete database backup (`pg_dump`) must be performed and verified prior to applying any schema alteration.
   - Migrations must never drop, truncate, or overwrite existing tables or production data.
