import { Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity()
export class Asset {
  @PrimaryGeneratedColumn()
  id: number;

  @Index({ unique: true })
  @Column({ type: 'varchar' })
  assetCode: string; // generated if empty

  @Column({ type: 'varchar' })
  name: string; // e.g., PC, Laptop, Printer

  @Index()
  @Column({ type: 'varchar', nullable: true })
  category: string | null; // optional grouping

  @Index()
  @Column({ type: 'varchar', nullable: true })
  serialNumber: string | null;

  @Index()
  @Column({ type: 'int', nullable: true })
  storeId: number | null;

  @Column({ type: 'varchar', nullable: true })
  storeName: string | null;

  @Column({ type: 'varchar', default: 'active' })
  status: string; // active | in_repair | retired | lost | disposed

  @Column({ type: 'date', nullable: true })
  purchaseDate: string | null; // ISO date (YYYY-MM-DD)

  @Column({ type: 'int', nullable: true })
  ageSnapshotMonths: number | null; // usia saat maintenance terakhir (opsional)

  @Column({ type: 'timestamp', nullable: true })
  lastMaintenanceDate: Date | null;

  @Column({ type: 'int', nullable: true })
  lastMaintenanceOrder: number | null;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;
}
