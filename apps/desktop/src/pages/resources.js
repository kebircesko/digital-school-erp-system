import { t } from "../services/i18n.js";
export function getResources() {
  const status = {
    key: "status",
    label: t("Statusi"),
    type: "select",
    options: [
      ["ACTIVE", t("Aktiv")],
      ["INACTIVE", t("Joaktiv")],
    ],
    default: "ACTIVE",
  };
  return {
    courses: {
      title: t("Kurset"),
      singular: t("kurs"),
      endpoint: "/courses",
      status: true,
      deletable: true,
      fields: [
        {
          key: "name",
          label: t("Emri i kursit"),
        },
        {
          key: "description",
          label: t("Përshkrimi"),
          type: "textarea",
          required: false,
          default: "",
        },
        {
          key: "monthlyPrice",
          label: t("Çmimi mujor EUR"),
          type: "money",
          default: "0.00",
        },
        {
          key: "durationMonths",
          label: t("Kohëzgjatja në muaj"),
          type: "number",
          default: 12,
        },
        status,
      ],
      columns: [
        {
          label: t("Kursi"),
          render: (r) => r.name,
        },
        {
          label: t("Çmimi mujor"),
          render: (r) =>
            r.monthlyPrice === undefined ? "—" : r.monthlyPrice + " €",
        },
        {
          label: t("Kohëzgjatja"),
          render: (r) => r.durationMonths + t(" muaj"),
        },
        {
          label: t("Statusi"),
          render: (r) => (r.status === "ACTIVE" ? t("Aktiv") : t("Joaktiv")),
        },
      ],
    },
    groups: {
      title: t("Grupet"),
      singular: t("grup"),
      endpoint: "/groups",
      status: true,
      deletable: true,
      fields: [
        {
          key: "name",
          label: t("Emri i grupit"),
        },
        {
          key: "courseId",
          label: t("Kursi"),
          endpoint: "/courses?status=ACTIVE",
          initialLabel: (r) => r.course?.name,
        },
        {
          key: "instructorId",
          label: t("Instruktori"),
          endpoint: "/groups/instructors",
          initialLabel: (r) => r.instructor?.name,
        },
        {
          key: "days",
          label: t("Ditët e mësimit"),
          type: "days",
          default: [1, 3],
        },
        {
          key: "startTime",
          label: t("Ora e fillimit"),
          type: "time",
          default: "16:00",
        },
        {
          key: "durationMinutes",
          label: t("Kohëzgjatja në minuta"),
          type: "number",
          default: 90,
        },
        {
          key: "capacity",
          label: t("Kapaciteti"),
          type: "number",
          default: 15,
        },
        status,
      ],
      columns: [
        {
          label: t("Grupi"),
          render: (r) => r.name,
        },
        {
          label: t("Kursi"),
          render: (r) => r.course.name,
        },
        {
          label: t("Instruktori"),
          render: (r) => r.instructor.name,
        },
        {
          label: t("Orari"),
          render: (r) =>
            r.days
              .map(
                (d) =>
                  [
                    "",
                    t("Hën"),
                    t("Mar"),
                    t("Mër"),
                    t("Enj"),
                    t("Pre"),
                    t("Sht"),
                    t("Die"),
                  ][d],
              )
              .join(", ") +
            " · " +
            r.startTime,
        },
        {
          label: t("Nxënës"),
          render: (r) => (r._count?.enrollments ?? 0) + " / " + r.capacity,
        },
        {
          label: t("Statusi"),
          render: (r) => (r.status === "ACTIVE" ? t("Aktiv") : t("Joaktiv")),
        },
      ],
    },
    enrollments: {
      title: t("Regjistrimet"),
      singular: t("regjistrim"),
      endpoint: "/enrollments",
      editable: false,
      fields: [
        {
          key: "studentId",
          label: t("Nxënësi"),
          endpoint: "/students?status=ACTIVE",
          initialLabel: (r) =>
            r.student ? `${r.student.firstName} ${r.student.lastName}` : "",
        },
        {
          key: "groupId",
          label: t("Grupi"),
          endpoint: "/groups?status=ACTIVE",
          initialLabel: (r) => r.group?.name,
        },
        {
          key: "startDate",
          label: t("Data e fillimit"),
          type: "date",
          default: new Date().toISOString().slice(0, 10),
        },
        {
          key: "endDate",
          label: t("Data e përfundimit"),
          type: "date",
          required: false,
        },
        {
          key: "monthlyPrice",
          label: t("Çmimi individual mujor EUR"),
          type: "money",
          default: "0.00",
        },
        {
          key: "discount",
          label: t("Zbritja mujore EUR"),
          type: "money",
          default: "0.00",
        },
        {
          key: "offer",
          label: t("Oferta / Shënime"),
          required: false,
          default: "",
        },
      ],
      columns: [
        {
          label: t("Nxënësi"),
          render: (r) => r.student.firstName + " " + r.student.lastName,
        },
        {
          label: t("Kursi / Grupi"),
          render: (r) => r.course.name + " / " + r.group.name,
        },
        {
          label: t("Fillimi"),
          render: (r) => r.startDate.slice(0, 10),
        },
        {
          label: t("Përfundimi"),
          render: (r) => r.endDate?.slice(0, 10) ?? t("Pa afat"),
        },
        {
          label: t("Çmimi / Zbritja"),
          render: (r) =>
            r.monthlyPrice === undefined
              ? "—"
              : `${r.monthlyPrice} / ${r.discount} €`,
        },
        {
          label: t("Statusi"),
          render: (r) => (r.status === "ACTIVE" ? t("Aktiv") : t("Përfunduar")),
        },
      ],
    },
    users: {
      title: t("Përdoruesit"),
      singular: t("përdorues"),
      endpoint: "/users",
      fields: [
        {
          key: "name",
          label: t("Emri"),
        },
        {
          key: "email",
          label: t("Emaili"),
          type: "email",
        },
        {
          key: "password",
          label: t("Fjalëkalimi (12+ karaktere; lëre bosh për ta ruajtur)"),
          type: "password",
          required: false,
        },
        {
          key: "role",
          label: t("Roli"),
          type: "select",
          options: [
            ["ADMIN", t("Administrator")],
            ["FINANCE", t("Financat")],
            ["INSTRUCTOR", t("Instruktor")],
          ],
          default: "INSTRUCTOR",
        },
        {
          key: "active",
          label: t("Llogari aktive"),
          type: "checkbox",
          default: true,
        },
      ],
      columns: [
        {
          label: t("Emri"),
          render: (r) => r.name,
        },
        {
          label: t("Emaili"),
          render: (r) => r.email,
        },
        {
          label: t("Roli"),
          render: (r) =>
            ({
              ADMIN: t("Administrator"),
              FINANCE: t("Financat"),
              INSTRUCTOR: t("Instruktor"),
            })[r.role],
        },
        {
          label: t("Statusi"),
          render: (r) => (r.active ? t("Aktiv") : t("Joaktiv")),
        },
      ],
    },
  };
}
