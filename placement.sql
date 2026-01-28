/* =========================
   DATABASE
========================= */
CREATE DATABASE placement;
-- \c placement;

/* =========================
   STUDENTSS
========================= */
CREATE TABLE studentss (
    enrollment_no SERIAL PRIMARY KEY,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50),
    gender VARCHAR(10),
    date_of_birth DATE,
    department VARCHAR(50),
    skills VARCHAR(255),
    year_of_study INT CHECK (year_of_study BETWEEN 1 AND 6),
    cgpa NUMERIC(3,2) CHECK (cgpa BETWEEN 0 AND 10),
    email VARCHAR(100) UNIQUE NOT NULL,
    phone VARCHAR(15),
    password TEXT NOT NULL CHECK (length(password) >= 60),
    resume_url TEXT,
    blacklist BOOLEAN DEFAULT FALSE,
    admission_date DATE CHECK (admission_date <= CURRENT_DATE),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT resume_url_format
        CHECK (resume_url IS NULL OR resume_url ~* '^https?://')
);

/* =========================
   ADMIN
========================= */
CREATE TABLE admin (
    admin_id SERIAL PRIMARY KEY,
    email VARCHAR(100) UNIQUE NOT NULL,
    password TEXT NOT NULL CHECK (length(password) >= 60),
    role VARCHAR(20) DEFAULT 'admin',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP
);

/* =========================
   COMPANIES
========================= */
CREATE TABLE companies (
    company_id SERIAL PRIMARY KEY,
    company_name VARCHAR(150) NOT NULL,
    company_mail VARCHAR(100) UNIQUE,
    job_role VARCHAR(100),
    min_cgpa NUMERIC(3,2) CHECK (min_cgpa BETWEEN 0 AND 10),
    package NUMERIC(10,2),
    average_package NUMERIC(10,2),
    status VARCHAR(20) NOT NULL
        CHECK (status IN ('Open','Closed','On Hold')),
    visit_date DATE CHECK (visit_date >= CURRENT_DATE),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

/* =========================
   COMPANY BRANCHES
========================= */
CREATE TABLE company_branches (
    company_id INT REFERENCES companies(company_id) ON DELETE CASCADE,
    branch VARCHAR(50),
    PRIMARY KEY (company_id, branch)
);

/* =========================
   APPLICATIONS
========================= */
CREATE TABLE applications (
    application_id SERIAL PRIMARY KEY,
    enrollment_no INT REFERENCES studentss(enrollment_no) ON DELETE CASCADE,
    company_id INT REFERENCES companies(company_id) ON DELETE CASCADE,
    applied_status BOOLEAN DEFAULT TRUE,
    application_status VARCHAR(20)
        CHECK (application_status IN ('Pending','Selected','Rejected'))
        DEFAULT 'Pending',
    applied_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    interview_date DATE,
    remarks TEXT,
    UNIQUE (enrollment_no, company_id)
);

/* =========================
   PLACEMENTS
========================= */
CREATE TABLE placements (
    enrollment_no INT NOT NULL REFERENCES studentss(enrollment_no),
    company_id INT NOT NULL REFERENCES companies(company_id),
    package NUMERIC(10,2),
    placed_date DATE DEFAULT CURRENT_DATE,
    PRIMARY KEY (enrollment_no)
);

/* =========================
   TIMESTAMP TRIGGER
========================= */
CREATE OR REPLACE FUNCTION update_student_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_student
BEFORE UPDATE ON studentss
FOR EACH ROW
EXECUTE FUNCTION update_student_timestamp();

/* =========================
   BLACKLIST CHECK
========================= */
CREATE OR REPLACE FUNCTION prevent_blacklisted_application()
RETURNS TRIGGER AS $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM studentss
        WHERE enrollment_no = NEW.enrollment_no
        AND blacklist = TRUE
    ) THEN
        RAISE EXCEPTION 'Blacklisted student cannot apply';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

/* =========================
   COMPANY STATUS CHECK
========================= */
CREATE OR REPLACE FUNCTION check_company_status()
RETURNS TRIGGER AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM companies
        WHERE company_id = NEW.company_id
        AND status = 'Open'
    ) THEN
        RAISE EXCEPTION 'Applications are closed for this company';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

/* =========================
   CGPA ELIGIBILITY CHECK
========================= */
CREATE OR REPLACE FUNCTION check_cgpa_eligibility()
RETURNS TRIGGER AS $$
DECLARE
    student_cgpa NUMERIC;
    company_min_cgpa NUMERIC;
BEGIN
    SELECT cgpa INTO student_cgpa
    FROM studentss
    WHERE enrollment_no = NEW.enrollment_no;

    IF student_cgpa IS NULL THEN
        RAISE EXCEPTION 'Student CGPA missing';
    END IF;

    SELECT min_cgpa INTO company_min_cgpa
    FROM companies
    WHERE company_id = NEW.company_id;

    IF company_min_cgpa IS NULL THEN
        RAISE EXCEPTION 'Company CGPA criteria missing';
    END IF;

    IF student_cgpa < company_min_cgpa THEN
        RAISE EXCEPTION 'Student CGPA below company requirement';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

/* =========================
   APPLY RULE TRIGGERS
========================= */
CREATE TRIGGER trg_blacklist_check
BEFORE INSERT ON applications
FOR EACH ROW
EXECUTE FUNCTION prevent_blacklisted_application();

CREATE TRIGGER trg_company_status_check
BEFORE INSERT ON applications
FOR EACH ROW
EXECUTE FUNCTION check_company_status();

CREATE TRIGGER trg_cgpa_check
BEFORE INSERT ON applications
FOR EACH ROW
EXECUTE FUNCTION check_cgpa_eligibility();

CREATE TRIGGER trg_blacklist_check_update
BEFORE UPDATE ON applications
FOR EACH ROW
EXECUTE FUNCTION prevent_blacklisted_application();

CREATE TRIGGER trg_company_status_check_update
BEFORE UPDATE ON applications
FOR EACH ROW
EXECUTE FUNCTION check_company_status();

CREATE TRIGGER trg_cgpa_check_update
BEFORE UPDATE ON applications
FOR EACH ROW
EXECUTE FUNCTION check_cgpa_eligibility();

/* =========================
   AUTO PLACEMENT INSERT
========================= */
CREATE OR REPLACE FUNCTION auto_insert_placement()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.application_status <> 'Selected'
       AND NEW.application_status = 'Selected' THEN

        INSERT INTO placements (enrollment_no, company_id, package)
        SELECT NEW.enrollment_no, NEW.company_id, c.package
        FROM companies c
        WHERE c.company_id = NEW.company_id
        ON CONFLICT (enrollment_no) DO NOTHING;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_auto_placement
AFTER UPDATE ON applications
FOR EACH ROW
EXECUTE FUNCTION auto_insert_placement();

/* =========================
   INDEXES
========================= */
CREATE INDEX idx_app_enrollment ON applications(enrollment_no);
CREATE INDEX idx_app_company ON applications(company_id);
CREATE INDEX idx_company_status ON companies(status);

/* =========================
   INSERT DATA
========================= */
INSERT INTO studentss
(first_name, last_name, gender, date_of_birth, department, skills,
 year_of_study, cgpa, email, phone, password, resume_url, admission_date)
VALUES
('Rahul','Sharma','Male','2003-05-10','CSE','Java,SQL',3,8.4,'rahul1@gmail.com','900000001','xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx','https://drive.google.com/resume1','2022-08-01'),
('Aisha','Khan','Female','2003-03-14','IT','Python,ML',3,8.9,'aisha@gmail.com','900000002','xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx','https://drive.google.com/resume2','2022-08-01'),
('Arjun','Verma','Male','2002-11-22','ECE','C,Embedded',4,7.8,'arjun@gmail.com','900000003','xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx','https://drive.google.com/resume3','2021-08-01'),
('Sneha','Patil','Female','2004-01-09','CSE','React,Node',2,9.1,'sneha@gmail.com','900000004','xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx','https://drive.google.com/resume4','2023-08-01'),
('Karan','Mehta','Male','2003-07-19','ME','AutoCAD',3,7.2,'karan@gmail.com','900000005','xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx','https://drive.google.com/resume5','2022-08-01'),
('Neha','Singh','Female','2002-09-30','CSE','DSA,C++',4,8.0,'neha@gmail.com','900000006','xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx','https://drive.google.com/resume6','2021-08-01'),
('Rohit','Gupta','Male','2003-12-12','IT','Java,Spring',3,7.9,'rohit@gmail.com','900000007','xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx','https://drive.google.com/resume7','2022-08-01'),
('Pooja','Nair','Female','2004-02-18','ECE','VLSI',2,8.3,'pooja@gmail.com','900000008','xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx','https://drive.google.com/resume8','2023-08-01'),
('Aman','Joshi','Male','2002-06-25','CSE','Python,Django',4,9.0,'aman@gmail.com','900000009','xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx','https://drive.google.com/resume9','2021-08-01'),
('Divya','Iyer','Female','2003-08-05','IT','Cloud,AWS',3,8.6,'divya@gmail.com','900000010','xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx','https://drive.google.com/resume10','2022-08-01'),
('Sahil','Bansal','Male','2003-04-11','CSE','Go,Docker',3,7.6,'sahil@gmail.com','900000011','xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx','https://drive.google.com/resume11','2022-08-01'),
('Ananya','Das','Female','2004-01-21','IT','UI/UX',2,8.7,'ananya@gmail.com','900000012','xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx','https://drive.google.com/resume12','2023-08-01'),
('Nikhil','Rao','Male','2002-10-10','ECE','Robotics',4,7.5,'nikhil@gmail.com','900000013','xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx','https://drive.google.com/resume13','2021-08-01'),
('Riya','Kapoor','Female','2003-06-30','CSE','Angular,TS',3,8.8,'riya@gmail.com','900000014','xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx','https://drive.google.com/resume14','2022-08-01'),
('Mohit','Yadav','Male','2004-03-15','ME','SolidWorks',2,7.1,'mohit@gmail.com','900000015','xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx','https://drive.google.com/resume15','2023-08-01');

INSERT INTO admin (email, password, role, last_login)
VALUES
('admin1@placement.com',
 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
 'admin',
 CURRENT_TIMESTAMP),
('admin2@placement.com',
 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
 'superadmin',
 CURRENT_TIMESTAMP);

INSERT INTO companies
(company_name, company_mail, job_role, min_cgpa, package, average_package, status, visit_date)
VALUES
('Microsoft','hr@microsoft.com','SDE',7.5,2100000,1900000,'Open',CURRENT_DATE),
('Accenture','hr@accenture.com','Associate Engineer',6.5,900000,800000,'Open',CURRENT_DATE),
('Wipro','hr@wipro.com','Project Engineer',6.0,750000,650000,'Open',CURRENT_DATE),
('Qualcomm','hr@qualcomm.com','Chip Design Engineer',7.8,1700000,1500000,'On Hold',CURRENT_DATE + INTERVAL '5 days');

INSERT INTO company_branches (company_id, branch) VALUES
(6,'CSE'), (6,'IT'),
(7,'CSE'), (7,'ME'),
(8,'CSE'), (8,'ECE'),
(9,'ECE'), (9,'CSE');

INSERT INTO applications (enrollment_no, company_id) VALUES
-- Microsoft (min CGPA 7.5)
(1,6),
(2,6),
(3,6),
(6,6),

-- Accenture (min CGPA 6.5)
(4,7),
(5,7),
(7,7),
(8,7),

-- Wipro (min CGPA 6.0)
(9,8),
(10,8),
(11,8),
(12,8);


UPDATE applications
SET application_status = 'Selected'
WHERE enrollment_no = 1 AND company_id = 6;

UPDATE applications
SET application_status = 'Selected'
WHERE enrollment_no = 9 AND company_id = 8;

UPDATE applications
SET application_status = 'Rejected'
WHERE enrollment_no = 5 AND company_id = 7;

ALTER TABLE studentss
DROP CONSTRAINT studentss_password_check;
INSERT INTO studentss
(first_name, last_name, gender, date_of_birth, department,
 year_of_study, cgpa, email, phone, password, admission_date)
VALUES
('Dummy','Student','Male','2004-01-01','CSE',
 2,7.0,'dummy@student.com','8888888888','897676','2023-08-01');





