--
-- PostgreSQL database dump
--

\restrict CHqgSYdYKAECaexY9XWR429YJROun6Hr8jIbrRgrzECkeb4nZQWUPdqZwTVLhMr

-- Dumped from database version 18.1
-- Dumped by pg_dump version 18.1

-- Started on 2026-05-06 18:54:19

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- TOC entry 2 (class 3079 OID 33441)
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- TOC entry 5086 (class 0 OID 0)
-- Dependencies: 2
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 220 (class 1259 OID 33479)
-- Name: alumnos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.alumnos (
    nocontrol character varying(15) NOT NULL,
    nombre character varying(100) NOT NULL,
    email character varying(100) NOT NULL,
    grupo character varying(10) NOT NULL,
    periodo character varying(10) NOT NULL,
    materia character varying(100) DEFAULT 'Sin asignar'::character varying NOT NULL,
    CONSTRAINT alumnos_email_formato CHECK (((email)::text ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'::text)),
    CONSTRAINT alumnos_grupo_notnull CHECK ((length(TRIM(BOTH FROM grupo)) > 0)),
    CONSTRAINT alumnos_nocontrol_formato CHECK (((nocontrol)::text ~ '^[A-Za-z]?[0-9]{2,10}$'::text)),
    CONSTRAINT alumnos_periodo_notnull CHECK ((length(TRIM(BOTH FROM periodo)) > 0))
);


ALTER TABLE public.alumnos OWNER TO postgres;

--
-- TOC entry 221 (class 1259 OID 33498)
-- Name: alumnos_con_password; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.alumnos_con_password (
    nocontrol character varying(15) NOT NULL,
    nombre character varying(100) NOT NULL,
    email character varying(100) NOT NULL,
    grupo character varying(10) NOT NULL,
    periodo character varying(10) NOT NULL,
    password character varying(255) NOT NULL,
    CONSTRAINT acp_email_formato CHECK (((email)::text ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'::text)),
    CONSTRAINT acp_grupo_notnull CHECK ((length(TRIM(BOTH FROM grupo)) > 0)),
    CONSTRAINT acp_nocontrol_formato CHECK (((nocontrol)::text ~ '^[A-Za-z]?[0-9]{2,10}$'::text)),
    CONSTRAINT acp_password_bcrypt CHECK (((password)::text ~ '^\$2[ayb]\$[0-9]{2}\$.{53}$'::text)),
    CONSTRAINT acp_periodo_notnull CHECK ((length(TRIM(BOTH FROM periodo)) > 0))
);


ALTER TABLE public.alumnos_con_password OWNER TO postgres;

--
-- TOC entry 223 (class 1259 OID 33518)
-- Name: hashing_alumno; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.hashing_alumno (
    id_hash integer NOT NULL,
    nocontrol character varying(15) NOT NULL,
    algoritmo character varying(30) NOT NULL,
    hash bytea NOT NULL,
    CONSTRAINT hashing_alumno_algoritmo_seguro CHECK (((algoritmo)::text = ANY ((ARRAY['SHA256'::character varying, 'SHA384'::character varying, 'SHA512'::character varying, 'SHA3-256'::character varying, 'SHA3-384'::character varying, 'SHA3-512'::character varying, 'BCRYPT'::character varying, 'ARGON2'::character varying])::text[])))
);


ALTER TABLE public.hashing_alumno OWNER TO postgres;

--
-- TOC entry 222 (class 1259 OID 33517)
-- Name: hashing_alumno_id_hash_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.hashing_alumno_id_hash_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.hashing_alumno_id_hash_seq OWNER TO postgres;

--
-- TOC entry 5087 (class 0 OID 0)
-- Dependencies: 222
-- Name: hashing_alumno_id_hash_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.hashing_alumno_id_hash_seq OWNED BY public.hashing_alumno.id_hash;


--
-- TOC entry 4903 (class 2604 OID 33521)
-- Name: hashing_alumno id_hash; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hashing_alumno ALTER COLUMN id_hash SET DEFAULT nextval('public.hashing_alumno_id_hash_seq'::regclass);


--
-- TOC entry 5077 (class 0 OID 33479)
-- Dependencies: 220
-- Data for Name: alumnos; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.alumnos (nocontrol, nombre, email, grupo, periodo, materia) FROM stdin;
\.


--
-- TOC entry 5078 (class 0 OID 33498)
-- Dependencies: 221
-- Data for Name: alumnos_con_password; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.alumnos_con_password (nocontrol, nombre, email, grupo, periodo, password) FROM stdin;
\.


--
-- TOC entry 5080 (class 0 OID 33518)
-- Dependencies: 223
-- Data for Name: hashing_alumno; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.hashing_alumno (id_hash, nocontrol, algoritmo, hash) FROM stdin;
\.


--
-- TOC entry 5088 (class 0 OID 0)
-- Dependencies: 222
-- Name: hashing_alumno_id_hash_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.hashing_alumno_id_hash_seq', 1, false);


--
-- TOC entry 4920 (class 2606 OID 33515)
-- Name: alumnos_con_password acp_email_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alumnos_con_password
    ADD CONSTRAINT acp_email_unique UNIQUE (email);


--
-- TOC entry 4922 (class 2606 OID 33513)
-- Name: alumnos_con_password acp_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alumnos_con_password
    ADD CONSTRAINT acp_pkey PRIMARY KEY (nocontrol);


--
-- TOC entry 4915 (class 2606 OID 33543)
-- Name: alumnos alumnos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alumnos
    ADD CONSTRAINT alumnos_pkey PRIMARY KEY (nocontrol, materia, grupo, periodo);


--
-- TOC entry 4925 (class 2606 OID 33530)
-- Name: hashing_alumno hashing_alumno_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hashing_alumno
    ADD CONSTRAINT hashing_alumno_pkey PRIMARY KEY (id_hash);


--
-- TOC entry 4927 (class 2606 OID 33532)
-- Name: hashing_alumno hashing_alumno_unique_nc_alg; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hashing_alumno
    ADD CONSTRAINT hashing_alumno_unique_nc_alg UNIQUE (nocontrol, algoritmo);


--
-- TOC entry 4923 (class 1259 OID 33516)
-- Name: idx_acp_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_acp_email ON public.alumnos_con_password USING btree (email);


--
-- TOC entry 4916 (class 1259 OID 33495)
-- Name: idx_alumnos_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_alumnos_email ON public.alumnos USING btree (email);


--
-- TOC entry 4917 (class 1259 OID 33496)
-- Name: idx_alumnos_grupo; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_alumnos_grupo ON public.alumnos USING btree (grupo);


--
-- TOC entry 4918 (class 1259 OID 33497)
-- Name: idx_alumnos_periodo; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_alumnos_periodo ON public.alumnos USING btree (periodo);


--
-- TOC entry 4928 (class 1259 OID 33539)
-- Name: idx_hashing_algoritmo; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_hashing_algoritmo ON public.hashing_alumno USING btree (algoritmo);


--
-- TOC entry 4929 (class 1259 OID 33538)
-- Name: idx_hashing_nocontrol; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_hashing_nocontrol ON public.hashing_alumno USING btree (nocontrol);


-- Completed on 2026-05-06 18:54:19

--
-- PostgreSQL database dump complete
--

\unrestrict CHqgSYdYKAECaexY9XWR429YJROun6Hr8jIbrRgrzECkeb4nZQWUPdqZwTVLhMr

