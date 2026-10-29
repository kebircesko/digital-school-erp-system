const status = {
  key: "status",
  label: "Statusi",
  type: "select",
  options: [
    ["ACTIVE", "Aktiv"],
    ["INACTIVE", "Joaktiv"],
  ],
  default: "ACTIVE",
};
export const resources = {
  courses: {
    title: "Kurset",
    singular: "kurs",
    endpoint: "/courses",
    status: true,
    deletable: true,
    fields: [
      { key: "name", label: "Emri i kursit" },
      {
        key: "description",
        label: "Përshkrimi",
        type: "textarea",
        required: false,
        default: "",
      },
      {
        key: "monthlyPrice",
        label: "Çmimi mujor EUR",
        type: "money",
        default: "0.00",
      },
      {
        key: "durationMonths",
        label: "Kohëzgjatja në muaj",
        type: "number",
        default: 12,
      },
      status,
    ],
    columns: [
      { label: "Kursi", render: (r) => r.name },
      {
        label: "Çmimi mujor",
        render: (r) =>
          r.monthlyPrice === undefined ? "—" : r.monthlyPrice + " €",
      },
      { label: "Kohëzgjatja", render: (r) => r.durationMonths + " muaj" },
      {
        label: "Statusi",
        render: (r) => (r.status === "ACTIVE" ? "Aktiv" : "Joaktiv"),
      },
    ],
  },
  groups: {
    title: "Grupet",
    singular: "grup",
    endpoint: "/groups",
    status: true,
    deletable: true,
    fields: [
      { key: "name", label: "Emri i grupit" },
      {
        key: "courseId",
        label: "Kursi",
        endpoint: "/courses?status=ACTIVE",
        initialLabel: (r) => r.course?.name,
      },
      {
        key: "instructorId",
        label: "Instruktori",
        endpoint: "/groups/instructors",
        initialLabel: (r) => r.instructor?.name,
      },
      { key: "days", label: "Ditët e mësimit", type: "days", default: [1, 3] },
      {
        key: "startTime",
        label: "Ora e fillimit",
        type: "time",
        default: "16:00",
      },
      {
        key: "durationMinutes",
        label: "Kohëzgjatja në minuta",
        type: "number",
        default: 90,
      },
      { key: "capacity", label: "Kapaciteti", type: "number", default: 15 },
      status,
    ],
    columns: [
      { label: "Grupi", render: (r) => r.name },
      { label: "Kursi", render: (r) => r.course.name },
      { label: "Instruktori", render: (r) => r.instructor.name },
      {
        label: "Orari",
        render: (r) =>
          r.days
            .map(
              (d) => ["", "Hën", "Mar", "Mër", "Enj", "Pre", "Sht", "Die"][d],
            )
            .join(", ") +
          " · " +
          r.startTime,
      },
      {
        label: "Nxënës",
        render: (r) => (r._count?.enrollments ?? 0) + " / " + r.capacity,
      },
      {
        label: "Statusi",
        render: (r) => (r.status === "ACTIVE" ? "Aktiv" : "Joaktiv"),
      },
    ],
  },
  enrollments: {
    title: "Regjistrimet",
    singular: "regjistrim",
    endpoint: "/enrollments",
    editable: false,
    fields: [
      {
        key: "studentId",
        label: "Nxënësi",
        endpoint: "/students?status=ACTIVE",
        initialLabel: (r) =>
          r.student ? `${r.student.firstName} ${r.student.lastName}` : "",
      },
      {
        key: "groupId",
        label: "Grupi",
        endpoint: "/groups?status=ACTIVE",
        initialLabel: (r) => r.group?.name,
      },
      {
        key: "startDate",
        label: "Data e fillimit",
        type: "date",
        default: new Date().toISOString().slice(0, 10),
      },
      {
        key: "endDate",
        label: "Data e përfundimit",
        type: "date",
        required: false,
      },
      {
        key: "monthlyPrice",
        label: "Çmimi individual mujor EUR",
        type: "money",
        default: "0.00",
      },
      {
        key: "discount",
        label: "Zbritja mujore EUR",
        type: "money",
        default: "0.00",
      },
      { key: "offer", label: "Oferta / Shënime", required: false, default: "" },
    ],
    columns: [
      {
        label: "Nxënësi",
        render: (r) => r.student.firstName + " " + r.student.lastName,
      },
      {
        label: "Kursi / Grupi",
        render: (r) => r.course.name + " / " + r.group.name,
      },
      { label: "Fillimi", render: (r) => r.startDate.slice(0, 10) },
      {
        label: "Përfundimi",
        render: (r) => r.endDate?.slice(0, 10) ?? "Pa afat",
      },
      {
        label: "Çmimi / Zbritja",
        render: (r) =>
          r.monthlyPrice === undefined
            ? "—"
            : `${r.monthlyPrice} / ${r.discount} €`,
      },
      {
        label: "Statusi",
        render: (r) => (r.status === "ACTIVE" ? "Aktiv" : "Përfunduar"),
      },
    ],
  },
  users: {
    title: "Përdoruesit",
    singular: "përdorues",
    endpoint: "/users",
    fields: [
      { key: "name", label: "Emri" },
      { key: "email", label: "Emaili", type: "email" },
      {
        key: "password",
        label: "Fjalëkalimi (12+ karaktere; lëre bosh për ta ruajtur)",
        type: "password",
        required: false,
      },
      {
        key: "role",
        label: "Roli",
        type: "select",
        options: [
          ["ADMIN", "Administrator"],
          ["FINANCE", "Financat"],
          ["INSTRUCTOR", "Instruktor"],
        ],
        default: "INSTRUCTOR",
      },
      {
        key: "active",
        label: "Llogari aktive",
        type: "checkbox",
        default: true,
      },
    ],
    columns: [
      { label: "Emri", render: (r) => r.name },
      { label: "Emaili", render: (r) => r.email },
      {
        label: "Roli",
        render: (r) =>
          ({
            ADMIN: "Administrator",
            FINANCE: "Financat",
            INSTRUCTOR: "Instruktor",
          })[r.role],
      },
      { label: "Statusi", render: (r) => (r.active ? "Aktiv" : "Joaktiv") },
    ],
  },
};
