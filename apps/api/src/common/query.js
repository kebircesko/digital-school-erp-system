"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListQuery = void 0;
exports.pagination = pagination;
const tslib_1 = require("tslib");
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
class ListQuery {
  search;
  status;
  courseId;
  groupId;
  studentId;
  period;
  from;
  to;
  method;
  page = 1;
  limit = 20;
}
exports.ListQuery = ListQuery;
tslib_1.__decorate(
  [
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(100),
    tslib_1.__metadata("design:type", String),
  ],
  ListQuery.prototype,
  "search",
  void 0,
);
tslib_1.__decorate(
  [
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(20),
    tslib_1.__metadata("design:type", String),
  ],
  ListQuery.prototype,
  "status",
  void 0,
);
tslib_1.__decorate(
  [
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    tslib_1.__metadata("design:type", String),
  ],
  ListQuery.prototype,
  "courseId",
  void 0,
);
tslib_1.__decorate(
  [
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    tslib_1.__metadata("design:type", String),
  ],
  ListQuery.prototype,
  "groupId",
  void 0,
);
tslib_1.__decorate(
  [
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    tslib_1.__metadata("design:type", String),
  ],
  ListQuery.prototype,
  "studentId",
  void 0,
);
tslib_1.__decorate(
  [
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Matches)(/^\d{4}-(0[1-9]|1[0-2])$/),
    tslib_1.__metadata("design:type", String),
  ],
  ListQuery.prototype,
  "period",
  void 0,
);
tslib_1.__decorate(
  [
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Matches)(/^\d{4}-\d{2}-\d{2}$/),
    tslib_1.__metadata("design:type", String),
  ],
  ListQuery.prototype,
  "from",
  void 0,
);
tslib_1.__decorate(
  [
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Matches)(/^\d{4}-\d{2}-\d{2}$/),
    tslib_1.__metadata("design:type", String),
  ],
  ListQuery.prototype,
  "to",
  void 0,
);
tslib_1.__decorate(
  [
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(["CASH", "BANK"]),
    tslib_1.__metadata("design:type", String),
  ],
  ListQuery.prototype,
  "method",
  void 0,
);
tslib_1.__decorate(
  [
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    tslib_1.__metadata("design:type", Object),
  ],
  ListQuery.prototype,
  "page",
  void 0,
);
tslib_1.__decorate(
  [
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(200),
    tslib_1.__metadata("design:type", Object),
  ],
  ListQuery.prototype,
  "limit",
  void 0,
);
function pagination(total, query, items) {
  return {
    items,
    total,
    page: query.page,
    pages: Math.max(1, Math.ceil(total / query.limit)),
  };
}
