import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CarClass } from './entities/car-class.entity';
import { CarModel } from './entities/car-model.entity';
import { CatalogSettings } from './entities/catalog-settings.entity';
import {
  CAR_CLASS_IDS,
  MODEL_ID_PATTERN,
  ZONE_IDS,
  type Rates,
} from './catalog.constants';
import { RatesDto, UpdateModelDto, UpdateSettingsDto } from './dto/catalog.dto';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

const SETTINGS_ID = 1;

const money = (v: number | null | undefined) =>
  v == null ? 'on request' : `₱${v.toLocaleString('en-PH')}`;
const ratesText = (rates: Rates) =>
  Object.entries(rates)
    .map(([zone, v]) => `${zone} ${money(v)}`)
    .join(', ');

// Keeps only the four zone keys, in a fixed order.
const toRates = (dto: RatesDto): Rates =>
  Object.fromEntries(ZONE_IDS.map((z) => [z, dto[z]])) as Rates;

// The admin's changes to the website's fleet: rates per car class, per-model
// availability/rates/photos, and the driver fee. The website merges these onto
// its built-in fleet, so anything not stored here keeps its built-in value.
@Injectable()
export class CatalogService {
  constructor(
    @InjectRepository(CarClass) private readonly classes: Repository<CarClass>,
    @InjectRepository(CarModel) private readonly models: Repository<CarModel>,
    @InjectRepository(CatalogSettings)
    private readonly settings: Repository<CatalogSettings>,
    private readonly audit: AuditLogsService,
  ) {}

  private log(action: string, label: string, summary: string) {
    this.audit.record({
      action,
      entityType: 'catalog',
      entityLabel: label,
      summary,
    });
  }

  async get() {
    const [classes, models, settings] = await Promise.all([
      this.classes.find(),
      this.models.find(),
      this.settings.findOne({ where: { id: SETTINGS_ID } }),
    ]);
    return {
      classes: Object.fromEntries(
        classes.map((c) => [c.id, { rates: c.rates }]),
      ),
      models: Object.fromEntries(
        models.map((m) => [
          m.id,
          { availability: m.availability, rates: m.rates, photos: m.photos },
        ]),
      ),
      driverRate: settings?.driverRate ?? null,
    };
  }

  async setClassRates(id: string, rates: RatesDto) {
    this.assertClassId(id);
    await this.classes.save({ id, rates: toRates(rates) });
    this.log(
      'catalog.class',
      id,
      `Changed the ${id} prices: ${ratesText(toRates(rates))}`,
    );
    return this.get();
  }

  async resetClass(id: string) {
    this.assertClassId(id);
    await this.classes.delete({ id });
    this.log(
      'catalog.class_reset',
      id,
      `Reset the ${id} prices to the website defaults`,
    );
    return this.get();
  }

  async updateModel(id: string, dto: UpdateModelDto) {
    this.assertModelId(id);
    const model =
      (await this.models.findOne({ where: { id } })) ??
      this.models.create({ id, photos: [] });
    if (dto.availability !== undefined) model.availability = dto.availability;
    if (dto.rates !== undefined) {
      model.rates = dto.rates === null ? null : toRates(dto.rates);
    }
    if (dto.photos !== undefined) {
      model.photos = dto.photos.map(({ url, label, color }) => ({
        url,
        label,
        color: color.toLowerCase(),
      }));
    }
    await this.models.save(model);
    const parts = [
      dto.availability !== undefined && `availability ${dto.availability}`,
      dto.rates !== undefined &&
        (dto.rates === null
          ? 'prices back to the class prices'
          : `prices ${ratesText(toRates(dto.rates))}`),
      dto.photos !== undefined &&
        `${dto.photos.length} photo${dto.photos.length === 1 ? '' : 's'}`,
    ].filter(Boolean);
    this.log(
      'catalog.model',
      id,
      `Updated the website car ${id}${parts.length ? `: ${parts.join('; ')}` : ''}`,
    );
    return this.get();
  }

  async resetModel(id: string) {
    this.assertModelId(id);
    await this.models.delete({ id });
    this.log(
      'catalog.model_reset',
      id,
      `Reset the website car ${id} to its defaults`,
    );
    return this.get();
  }

  async updateSettings(dto: UpdateSettingsDto) {
    await this.settings.save({ id: SETTINGS_ID, driverRate: dto.driverRate });
    this.log(
      'catalog.settings',
      'driver rate',
      `Changed the driver rate to ${money(dto.driverRate)} a day`,
    );
    return this.get();
  }

  private assertClassId(id: string) {
    if (!(CAR_CLASS_IDS as readonly string[]).includes(id)) {
      throw new BadRequestException(`Unknown car class "${id}"`);
    }
  }

  private assertModelId(id: string) {
    if (id.length > 60 || !MODEL_ID_PATTERN.test(id)) {
      throw new BadRequestException(`Invalid car model id "${id}"`);
    }
  }
}
